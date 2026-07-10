/**
 * Sipariş bildirim mailleri MÜŞTERİNİN locale'iyle gönderilir (mağaza primary=en olduğundan
 * locale'siz müşteriye İngilizce gider). Türk müşterilerde 'tr' garantile:
 *  - mevcut müşteri → locale tr değilse güncelle
 *  - yeni misafir → siparişten ÖNCE tr locale'li müşteri oluştur (Shopify siparişi email ile eşler,
 *    onay maili tr şablonuyla gider — translationsRegister ile 13 şablon Türkçeleştirildi)
 * Best-effort: hata akışı bozmaz.
 */
import { shopifyGraphQL } from './client';

export async function ensureTrCustomer(email: string | null | undefined): Promise<void> {
  if (!email || !email.includes('@')) return;
  try {
    const q = await shopifyGraphQL<{
      customers: { edges: Array<{ node: { id: string; locale: string | null } }> };
    }>(
      `query($q: String!){ customers(first: 1, query: $q){ edges{ node{ id locale } } } }`,
      { q: `email:${email.trim()}` },
    );
    const node = q.customers.edges[0]?.node;
    if (node) {
      if ((node.locale ?? '').toLowerCase().startsWith('tr')) return;
      await shopifyGraphQL(
        `mutation($input: CustomerInput!){ customerUpdate(input: $input){ userErrors{ message } } }`,
        { input: { id: node.id, locale: 'tr' } },
      );
    } else {
      await shopifyGraphQL(
        `mutation($input: CustomerInput!){ customerCreate(input: $input){ userErrors{ message } } }`,
        { input: { email: email.trim(), locale: 'tr' } },
      );
    }
  } catch (e) {
    console.error('[ensureTrCustomer]', e instanceof Error ? e.message : String(e));
  }
}
