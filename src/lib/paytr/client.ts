/**
 * PayTR iFrame API client.
 *
 * Adım 1: get-token → ödeme iframe token'ı (https://www.paytr.com/odeme/guvenli/{token}).
 * Adım 2: callback (bildirim URL) hash doğrulama.
 *
 * Hash (RESMİ SPEC — dev.paytr.com, GitHub referansıyla çapraz doğrulandı):
 *   token:    base64( HMAC-SHA256( merchant_id+user_ip+merchant_oid+email+payment_amount+
 *                                  user_basket+no_installment+max_installment+currency+test_mode
 *                                  + merchant_salt , merchant_key ) )
 *   callback: base64( HMAC-SHA256( merchant_oid+merchant_salt+status+total_amount , merchant_key ) )
 */
import crypto from 'node:crypto';
import { env } from '../env';
import { getStoreSettings } from '../settings/store';

export interface PaytrBasketItem {
  name: string;
  priceTl: number; // TL (kuruş değil) — user_basket "12.34" formatı bekler
  quantity: number;
}

export interface PaytrTokenParams {
  merchantOid: string; // benzersiz, alfanumerik (max 64)
  email: string;
  paymentAmountKurus: number; // KURUŞ (TL×100), integer
  basket: PaytrBasketItem[];
  userIp: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  okUrl: string; // browser başarı redirect
  failUrl: string; // browser hata redirect
  noInstallment?: number; // 0|1 (default 0 = taksit açık)
  maxInstallment?: number; // 0-12 (0 = sistem default)
  currency?: string; // TL (default)
  lang?: string; // tr (default)
  timeoutLimit?: number; // dakika (default 30)
}

export type PaytrTokenResult = { ok: true; token: string } | { ok: false; error: string };

function hmacB64(message: string, key: string): string {
  return crypto.createHmac('sha256', key).update(message, 'utf8').digest('base64');
}

/** user_basket: [["Ürün","12.34",2],...] → JSON → base64 */
export function buildUserBasket(items: PaytrBasketItem[]): string {
  const arr = items.map((it) => [it.name.slice(0, 100), it.priceTl.toFixed(2), it.quantity]);
  return Buffer.from(JSON.stringify(arr), 'utf8').toString('base64');
}

export async function paytrConfigured(): Promise<boolean> {
  const p = (await getStoreSettings()).payment;
  return !!((p.paytr_merchant_id || env.PAYTR_MERCHANT_ID) && (p.paytr_merchant_key || env.PAYTR_MERCHANT_KEY) && (p.paytr_merchant_salt || env.PAYTR_MERCHANT_SALT));
}

export async function getPaytrToken(p: PaytrTokenParams): Promise<PaytrTokenResult> {
  const ps = (await getStoreSettings()).payment;
  const mid = ps.paytr_merchant_id || env.PAYTR_MERCHANT_ID;
  const mkey = ps.paytr_merchant_key || env.PAYTR_MERCHANT_KEY;
  const msalt = ps.paytr_merchant_salt || env.PAYTR_MERCHANT_SALT;
  if (!mid || !mkey || !msalt) return { ok: false, error: 'PAYTR kimlik bilgileri eksik' };

  const testMode = ps.paytr_test_mode ?? env.PAYTR_TEST_MODE ?? 1;
  const noInst = p.noInstallment ?? 0;
  const maxInst = p.maxInstallment ?? 0;
  const currency = p.currency ?? 'TL';
  const userBasket = buildUserBasket(p.basket);
  const paymentAmount = String(Math.round(p.paymentAmountKurus)); // kuruş, integer string

  // hash_str — SIRA KRİTİK (spec)
  const hashStr =
    mid + p.userIp + p.merchantOid + p.email + paymentAmount + userBasket + noInst + maxInst + currency + testMode;
  const paytrToken = hmacB64(hashStr + msalt, mkey);

  const form = new URLSearchParams({
    merchant_id: mid,
    user_ip: p.userIp,
    merchant_oid: p.merchantOid,
    email: p.email,
    payment_amount: paymentAmount,
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: '1',
    no_installment: String(noInst),
    max_installment: String(maxInst),
    user_name: p.userName.slice(0, 60),
    user_address: p.userAddress.slice(0, 400),
    user_phone: p.userPhone.slice(0, 20),
    merchant_ok_url: p.okUrl,
    merchant_fail_url: p.failUrl,
    timeout_limit: String(p.timeoutLimit ?? 30),
    currency,
    test_mode: String(testMode),
    lang: p.lang ?? 'tr',
  });

  try {
    const resp = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const j = (await resp.json()) as { status?: string; token?: string; reason?: string };
    if (j.status === 'success' && j.token) return { ok: true, token: j.token };
    return { ok: false, error: j.reason || `PAYTR token alınamadı (HTTP ${resp.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Callback hash doğrula (timing-safe).
 * hash = base64( HMAC-SHA256( merchant_oid + merchant_salt + status + total_amount , merchant_key ) )
 *
 * ⚠️ Credential kaynağı get-token ile AYNI olmalı: ÖNCE DB (admin ayarı), sonra env.
 * (Aksi halde init DB-creds ile geçerli token alır ama callback env-creds ile hash doğrular
 *  → hash HİÇBİR ZAMAN tutmaz → 400 → draft asla complete edilmez = takılı sipariş.)
 */
export async function verifyPaytrCallback(
  merchantOid: string,
  status: string,
  totalAmount: string,
  receivedHash: string,
): Promise<boolean> {
  const ps = (await getStoreSettings()).payment;
  const mkey = ps.paytr_merchant_key || env.PAYTR_MERCHANT_KEY;
  const msalt = ps.paytr_merchant_salt || env.PAYTR_MERCHANT_SALT;
  if (!mkey || !msalt || !receivedHash) return false;
  const expected = hmacB64(merchantOid + msalt + status + totalAmount, mkey);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(receivedHash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** merchant_oid'e Shopify draft order id'sini göm (callback'te geri çıkar). Alfanumerik. */
export function buildMerchantOid(draftOrderId: number | null, uniq: string): string {
  // vm{draftId}t{uniq}  → callback: /^vm(\d+)t/ ile draftId
  return `vm${draftOrderId ?? 0}t${uniq}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
}

export function parseDraftIdFromOid(merchantOid: string): string | null {
  const m = /^vm(\d+)t/.exec(merchantOid);
  const id = m?.[1];
  return id && id !== '0' ? id : null;
}
