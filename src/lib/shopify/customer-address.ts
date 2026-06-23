/**
 * Müşteri sipariş verince adresini YAPILANDIRILMIŞ olarak adres defterine kaydeder.
 *
 * Neden: Shopify'ın native TR adres formunda İL (province) ve MAHALLE alanı YOK → müşteri
 * native formdan eklediğinde adres eksik kalıyor, her siparişte yeniden tamamlamak gerekiyor.
 * Biz checkout cascade'inden gelen il/ilçe/mahalle'yi Shopify alanlarına eşleyip kaydederiz:
 *   province = il, city = ilçe, address2 = mahalle, address1 = açık adres
 * → bir sonraki checkout'ta "Kayıtlı adreslerim" seçici ÜÇÜNÜ DE tam doldurur.
 *
 * Best-effort: hata olursa sipariş akışını BOZMAZ (sessiz geçer). Dedup'lu (aynı adres 2 kez eklenmez).
 */
import { provinceCode } from './tr-provinces';
import { env } from '../env';

export interface CustomerAddressInput {
  customerId?: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
  address1?: string;
  address2?: string; // mahalle
  city?: string; // ilçe
  province?: string; // il
  zip?: string;
}

const norm = (s?: string): string => (s || '').trim().toLocaleLowerCase('tr');

export async function upsertCustomerAddress(p: CustomerAddressInput): Promise<void> {
  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  // Yapılandırılmış kayıt için en az il + ilçe + açık adres + giriş yapmış müşteri şart
  if (!token || !p.customerId || !p.address1?.trim() || !p.province?.trim() || !p.city?.trim()) return;

  const base = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}`;
  const h = { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' };

  try {
    // Dedup: aynı (açık adres + ilçe + il + posta) zaten varsa ekleme
    const listResp = await fetch(`${base}/customers/${p.customerId}/addresses.json`, { headers: h });
    if (listResp.ok) {
      const list = (await listResp.json()) as { addresses?: Array<Record<string, string>> };
      const dup = (list.addresses || []).some(
        (a) =>
          norm(a.address1) === norm(p.address1) &&
          norm(a.city) === norm(p.city) &&
          norm(a.province) === norm(p.province) &&
          norm(a.zip) === norm(p.zip) &&
          norm(a.address2) === norm(p.address2),
      );
      if (dup) return;
    }

    const pcode = provinceCode(p.province);
    const address: Record<string, unknown> = {
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      phone: (p.phone || '').replace(/\s/g, ''),
      address1: p.address1,
      address2: p.address2 || '', // mahalle
      city: p.city, // ilçe
      province: p.province, // il
      zip: p.zip || '',
      country: 'Turkey',
      country_code: 'TR',
    };
    if (pcode) address.province_code = pcode;

    await fetch(`${base}/customers/${p.customerId}/addresses.json`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ address }),
    });
  } catch {
    /* best-effort — sipariş akışını bozma */
  }
}
