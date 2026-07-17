/**
 * Shopify siparişini programatik "ödendi" (paid) yapar — COD/kapıda ödeme akışı için.
 *
 * COD'de bir authorization transaction'ı olmadığından `kind:'capture'` 422 verir;
 * `kind:'sale'` ile doğrudan başarılı satış transaction'ı eklenir → Shopify
 * financial_status'u paid'e çevirir ve orders/paid webhook'unu tetikler.
 *
 * Idempotent: sipariş zaten paid ise POST atmaz (çift transaction/çift tahakkuk önlenir).
 */
import { shopifyRest } from './client';

export interface ShopifyPaidResult {
  ok: boolean;
  alreadyPaid?: boolean;
  error?: string;
}

export async function markShopifyOrderPaid(
  numericOrderId: string,
  amount: string,
  gateway = 'Kapıda Ödeme',
): Promise<ShopifyPaidResult> {
  if (!numericOrderId) return { ok: false, error: 'numericOrderId boş' };
  try {
    // Idempotency: mevcut ödeme durumunu oku. Yalnız 'pending'/'authorized' siparişe sale ekle.
    // paid / partially_paid / refunded / partially_refunded / voided → DOKUNMA (çift tahsil, iade
    // sonrası yeniden-paid gibi hatalı durumları önler).
    const cur = await shopifyRest<{ order?: { financial_status?: string } }>(
      `/orders/${numericOrderId}.json?fields=financial_status`,
    );
    const fin = cur.order?.financial_status;
    if (fin && fin !== 'pending' && fin !== 'authorized') {
      return { ok: true, alreadyPaid: true };
    }

    await shopifyRest(`/orders/${numericOrderId}/transactions.json`, {
      method: 'POST',
      body: JSON.stringify({
        transaction: {
          kind: 'sale',
          status: 'success',
          amount,
          currency: 'TRY',
          gateway,
        },
      }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
