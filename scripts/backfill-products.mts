/**
 * Shopify → AWS ürün backfill.
 * Tüm Shopify ürünlerini çekip ingestShopifyProduct ile DB'ye upsert eder.
 * EC2'de çalıştırılır (DB + Shopify erişimi env'den).
 *
 * Kullanım (sunucuda, repo kökünden):
 *   set -a && source .env.production && set +a
 *   ./node_modules/.bin/tsx scripts/backfill-products.mts                 # sadece fark raporu
 *   ./node_modules/.bin/tsx scripts/backfill-products.mts --limit=10      # ilk 10 kuru kontrol
 *   BACKFILL_ALLOW_WRITE=1 ./node_modules/.bin/tsx scripts/backfill-products.mts --apply
 *
 * Yazma hiçbir zaman varsayılan değildir. Prod envanterini taşırken önce
 * farkı ölçüp sonra açık uygulama anahtarıyla güvenle idempotent upsert yap.
 */
import { ingestShopifyProduct, type ShopifyProductPayload } from '../src/lib/shopify/product-ingest.ts';
import { db } from '../src/db/client.ts';
import { products } from '../src/db/schema/products.ts';
import { backfillArgumanlari } from '../src/lib/shopify/backfill-mode.ts';

const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
if (!DOMAIN || !TOKEN) {
  console.error('SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN env yok');
  process.exit(1);
}
const API = `https://${DOMAIN}/admin/api/${process.env.SHOPIFY_API_VERSION || '2025-01'}`;
const MOD = backfillArgumanlari(process.argv.slice(2));
if (MOD.apply && process.env.BACKFILL_ALLOW_WRITE !== '1') {
  console.error('CANLI DB yazma kapalı: --apply için BACKFILL_ALLOW_WRITE=1 de zorunlu');
  process.exit(2);
}

async function shopGet(url: string): Promise<{ body: { products: ShopifyProductPayload[] }; nextUrl: string | null }> {
  const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': TOKEN as string } });
  if (!r.ok) throw new Error(`Shopify ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const link = r.headers.get('Link') || r.headers.get('link') || '';
  const m = link.match(/<([^>]+)>;\s*rel="next"/);
  const nextUrl = m ? m[1] : null;
  // Pagination URL'si başka host olursa token üçüncü tarafa ASLA taşınmaz.
  if (nextUrl && new URL(nextUrl).origin !== new URL(API).origin) throw new Error('Shopify next URL host uyuşmuyor');
  return { body: (await r.json()) as { products: ShopifyProductPayload[] }, nextUrl };
}

async function main() {
  const limitArg = MOD.limit;
  let url: string | null = `${API}/products.json?limit=250`;
  let total = 0;
  let created = 0;
  let updated = 0;
  let fail = 0;
  let missing = 0;
  let existing = 0;
  const byVendor: Record<string, number> = {};
  const yerel = new Set((await db.select({ id: products.shopifyProductId }).from(products))
    .map((p) => String(p.id)));
  console.log(`MODE=${MOD.apply ? 'APPLY' : 'DRY-RUN'} / RDS kayıtlı=${yerel.size} / Shopify taranıyor...`);

  while (url) {
    const { body, nextUrl } = await shopGet(url);
    for (const p of body.products) {
      const kayitli = yerel.has(String(p.id));
      if (kayitli) existing++; else missing++;
      total++;
      if (MOD.apply) {
        const res = await ingestShopifyProduct(p);
        if (res.ok) {
          if (res.isNew) created++;
          else updated++;
          const vs = res.vendorSlug || '?';
          byVendor[vs] = (byVendor[vs] || 0) + 1;
        } else {
          fail++;
          console.error(`  FAIL id=${p.id} "${String(p.title).slice(0, 30)}": ${res.error}`);
        }
      }
      if (total % 25 === 0) console.log(`  ... ${total} tarandı (eksik=${missing} mevcut=${existing} written=${created + updated} fail=${fail})`);
      if (limitArg && total >= limitArg) {
        url = null;
        break;
      }
    }
    if (url) url = nextUrl;
  }

  console.log('\nBİTTİ →', JSON.stringify({ mode: MOD.apply ? 'apply' : 'dry-run', total, missing, existing, created, updated, fail, byVendor }, null, 2));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
