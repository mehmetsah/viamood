/**
 * Email ile Shopify müşterisini bul; yoksa oluştur. Shopify customer ID (string) döner.
 *
 * Kullanım: Portal'da NextAuth-only müşteri (Shopify hesabı olmayan) ilk adresini eklerken
 * çağrılır → Shopify customer açılır → adres Shopify'a push edilebilir → checkout
 * "Kayıtlı adreslerim" selector'ında görünür. Best-effort: hata olursa null döner.
 *
 * Not: create body'sine telefon KONULMAZ (Shopify telefon unique → 422 çakışması yaygın);
 * telefon adresin kendi alanında taşınır.
 */
import { env } from '../env';

export async function findOrCreateShopifyCustomer(
  email: string,
  name?: string | null,
): Promise<string | null> {
  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const e = (email || '').trim().toLowerCase();
  if (!token || !e) return null;

  const base = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}`;
  const h = { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' };

  const searchByEmail = async (): Promise<string | null> => {
    const resp = await fetch(
      `${base}/customers/search.json?query=${encodeURIComponent('email:' + e)}`,
      { headers: h },
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as { customers?: Array<{ id?: number }> };
    const found = data.customers?.find((c) => c.id);
    return found?.id ? String(found.id) : null;
  };

  try {
    const existing = await searchByEmail();
    if (existing) return existing;

    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    const body = {
      customer: {
        email: e,
        first_name: parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || undefined,
        last_name: parts.length > 1 ? parts[parts.length - 1] : undefined,
        verified_email: true,
      },
    };
    const resp = await fetch(`${base}/customers.json`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { customer?: { id?: number } };
      if (data.customer?.id) return String(data.customer.id);
    }
    // Create başarısız (örn. yarış / email çakışması) → tekrar ara
    return await searchByEmail();
  } catch (e2) {
    console.error('[shopify] findOrCreateShopifyCustomer failed:', e2 instanceof Error ? e2.message : e2);
    return null;
  }
}
