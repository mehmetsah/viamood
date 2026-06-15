/**
 * Shopify → AWS ürün backfill.
 * Tüm Shopify ürünlerini çekip ingestShopifyProduct ile DB'ye upsert eder.
 * EC2'de çalıştırılır (DB + Shopify erişimi env'den).
 *
 * Kullanım (sunucuda, repo kökünden):
 *   set -a && source .env.production && set +a
 *   ./node_modules/.bin/tsx scripts/backfill-products.mts        # hepsi
 *   ./node_modules/.bin/tsx scripts/backfill-products.mts 2      # ilk 2 (test)
 */
import { ingestShopifyProduct, type ShopifyProductPayload } from '../src/lib/shopify/product-ingest.ts';

const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
if (!DOMAIN || !TOKEN) {
  console.error('SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN env yok');
  process.exit(1);
}
const API = `https://${DOMAIN}/admin/api/2025-01`;

async function shopGet(url: string): Promise<{ body: { products: ShopifyProductPayload[] }; nextUrl: string | null }> {
  const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': TOKEN as string } });
  if (!r.ok) throw new Error(`Shopify ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const link = r.headers.get('Link') || r.headers.get('link') || '';
  const m = link.match(/<([^>]+)>;\s*rel="next"/);
  return { body: (await r.json()) as { products: ShopifyProductPayload[] }, nextUrl: m ? m[1] : null };
}

async function main() {
  const limitArg = process.argv[2] ? Number(process.argv[2]) : null;
  let url: string | null = `${API}/products.json?limit=250`;
  let total = 0;
  let created = 0;
  let updated = 0;
  let fail = 0;
  const byVendor: Record<string, number> = {};

  while (url) {
    const { body, nextUrl } = await shopGet(url);
    for (const p of body.products) {
      const res = await ingestShopifyProduct(p);
      total++;
      if (res.ok) {
        if (res.isNew) created++;
        else updated++;
        const vs = res.vendorSlug || '?';
        byVendor[vs] = (byVendor[vs] || 0) + 1;
      } else {
        fail++;
        console.error(`  FAIL id=${p.id} "${String(p.title).slice(0, 30)}": ${res.error}`);
      }
      if (total % 25 === 0) console.log(`  ... ${total} işlendi (created=${created} updated=${updated} fail=${fail})`);
      if (limitArg && total >= limitArg) {
        url = null;
        break;
      }
    }
    if (url) url = nextUrl;
  }

  console.log('\nBİTTİ →', JSON.stringify({ total, created, updated, fail, byVendor }, null, 2));
  process.exit(fail > 0 && fail >= total ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
