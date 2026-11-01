/**
 * #994995 · Ürün açıklamasındaki GÖRÜNMEZ sohbet-arayüzü kalıntısını soyma — sunucuda (EC2) koşar; Shopify erişimi env'den.
 *
 *   cd /var/www/viamood && set -a && . ./.env.production && set +a
 *   npx tsx scripts/aciklama-sinif-soy.mts                 # DRY-RUN (varsayılan) — tek bayt yazmaz
 *   npx tsx scripts/aciklama-sinif-soy.mts --uygula        # yazar: productUpdate(descriptionHtml)
 *   isteğe bağlı: --handle=<h>  (tek ürün) · --kutuk=<yol.jsonl>  (varsayılan: $LOG_DIR ya da ~/.viamood-log altında tarih damgalı)
 *
 * Karar mantığı TEK YERDE: src/lib/aciklama-sinif-soy.ts (çivi: tests/aciklama-sinif-soy.test.ts).
 * Hedef küme: açıklamasında `font-claude-response` geçen ürünler. Görünür iç not taşıyanlar ATLANIR (elle taslak).
 * `--uygula` kipinde yazmadan hemen önce ürün yeniden okunur; arada değişmişse yazılmaz.
 * Kütük `soyuldu` satırında soyma öncesi HTML'i taşır — geri alma o satırdan yapılır.
 * ⛔ Toplu yazma müşteriye görünen ürün sayfasının kaynağını değiştirir — koşmadan önce sahibin onayı gerekir.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { KALINTI_ISARETI, sinifSoyCalistir, type KutukSatiri, type Urun } from '../src/lib/aciklama-sinif-soy.ts';
import { aciklamaYazKapisi } from '../src/lib/aciklama-yer-tutucu.ts';

const args = process.argv.slice(2);
const uygula = args.includes('--uygula');
const tekHandle = args.find((a) => a.startsWith('--handle='))?.slice(9);
const bilinmeyen = args.filter((a) => a !== '--uygula' && !a.startsWith('--handle=') && !a.startsWith('--kutuk='));
if (bilinmeyen.length) {
  console.error('Kullanım: aciklama-sinif-soy.mts [--uygula] [--handle=<h>] [--kutuk=yol.jsonl]');
  process.exit(2);
}
const kutukYolu = args.find((a) => a.startsWith('--kutuk='))?.slice(8)
  || path.join(process.env.LOG_DIR || path.join(homedir(), '.viamood-log'), `aciklama-sinif-soy-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
mkdirSync(path.dirname(kutukYolu), { recursive: true });

const domain = (process.env.SHOPIFY_STORE_DOMAIN ?? '').trim();
const token = (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? '').trim();
const surum = (process.env.SHOPIFY_API_VERSION ?? '2025-01').trim();
if (!domain || !token) { console.error('SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN eksik'); process.exit(2); }

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const r = await fetch(`https://${domain}/admin/api/${surum}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const j = (await r.json()) as { data?: T; errors?: unknown };
  if (!r.ok || j.errors || !j.data) throw new Error(`shopify ${r.status} ${JSON.stringify(j.errors ?? '').slice(0, 300)}`);
  return j.data;
}

type Dugum = { id: string; handle: string; descriptionHtml: string | null };

async function* hedefler(): AsyncGenerator<Urun> {
  let after: string | null = null;
  const q = tekHandle ? `handle:${tekHandle}` : null;
  do {
    const d: { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Dugum[] } } = await gql(
      'query($c:String,$q:String){products(first:100,after:$c,query:$q){pageInfo{hasNextPage endCursor} nodes{id handle descriptionHtml}}}',
      { c: after, q },
    );
    for (const n of d.products.nodes) {
      const html = n.descriptionHtml ?? '';
      if (html.includes(KALINTI_ISARETI) && (!tekHandle || n.handle === tekHandle)) yield { id: n.id, handle: n.handle, html };
    }
    after = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
  } while (after);
}

const ozet = await sinifSoyCalistir(
  hedefler(),
  {
    yaz: async (u, yeniHtml) => {
      const kapi = aciklamaYazKapisi(yeniHtml); if (!kapi.ok) return kapi; // #994831 yer tutucu / iç not yazılmaz (md.52)
      // Okuma ile yazma arasında ürün elle düzenlendiyse onun üstüne yazılmaz.
      const g: { product: { descriptionHtml: string | null } | null } = await gql('query($id:ID!){product(id:$id){descriptionHtml}}', { id: u.id });
      if ((g.product?.descriptionHtml ?? '') !== u.html) return { ok: false, hata: 'okuma ile yazma arasında açıklama değişti — yazılmadı' };
      const m: { productUpdate: { userErrors: Array<{ field: string[] | null; message: string }> } } = await gql(
        'mutation($p:ProductUpdateInput!){productUpdate(product:$p){userErrors{field message}}}',
        { p: { id: u.id, descriptionHtml: yeniHtml } },
      );
      const e = m.productUpdate.userErrors;
      return e.length ? { ok: false, hata: e.map((x) => x.message).join('; ') } : { ok: true };
    },
    kutuk: (s: KutukSatiri) => appendFileSync(kutukYolu, JSON.stringify({ ts: new Date().toISOString(), ...s }) + '\n'),
  },
  { uygula },
);
console.log(JSON.stringify({ kip: uygula ? 'uygula' : 'dry-run', kutuk: kutukYolu, ozet }, null, 1));
process.exit(ozet.hata > 0 ? 1 : 0);
