/**
 * #994831 · Pola açıklamalarındaki müşteriye görünen iç başlıkları kaldırma — sunucuda (EC2) koşar.
 *
 *   cd /var/www/viamood && set -a && . ./.env.production && set +a
 *   npx tsx scripts/aciklama-ic-baslik.mts               # DRY-RUN (varsayılan) — tek bayt yazmaz
 *   npx tsx scripts/aciklama-ic-baslik.mts --uygula      # yazar: productUpdate(descriptionHtml)
 *   isteğe bağlı: --kutuk=<yol.jsonl>
 *
 * Hedef: durumu ACTIVE olan ve üç kalıptan birini taşıyan ürünler. Karar ve metin kapısı TEK YERDE:
 * src/lib/aciklama-ic-baslik.ts (çivi: tests/aciklama-ic-baslik.test.ts). Çıkış kodu: hata > 0 ise 1.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { icBaslikCalistir, kalipSayilari, type KutukSatiri, type Urun } from '../src/lib/aciklama-ic-baslik.ts';

const args = process.argv.slice(2);
const uygula = args.includes('--uygula');
if (args.some((a) => a !== '--uygula' && !a.startsWith('--kutuk='))) { console.error('Kullanım: aciklama-ic-baslik.mts [--uygula] [--kutuk=yol.jsonl]'); process.exit(2); }
const kutukYolu = args.find((a) => a.startsWith('--kutuk='))?.slice(8)
  || path.join(process.env.LOG_DIR || path.join(homedir(), '.viamood-log'), `aciklama-ic-baslik-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
mkdirSync(path.dirname(kutukYolu), { recursive: true });

const domain = (process.env.SHOPIFY_STORE_DOMAIN ?? '').trim();
const token = (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? '').trim();
const surum = (process.env.SHOPIFY_API_VERSION ?? '2025-01').trim();
if (!domain || !token) { console.error('SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN eksik'); process.exit(2); }

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const r = await fetch(`https://${domain}/admin/api/${surum}/graphql.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token }, body: JSON.stringify({ query, variables }),
  });
  const j = (await r.json()) as { data?: T; errors?: unknown };
  if (!r.ok || j.errors || !j.data) throw new Error(`shopify ${r.status} ${JSON.stringify(j.errors ?? '').slice(0, 300)}`);
  return j.data;
}

async function* hedefler(): AsyncGenerator<Urun> {
  let after: string | null = null;
  do {
    const d: { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Array<{ id: string; handle: string; descriptionHtml: string | null }> } } = await gql(
      'query($c:String){products(first:100,after:$c,query:"status:active"){pageInfo{hasNextPage endCursor} nodes{id handle descriptionHtml}}}', { c: after });
    for (const n of d.products.nodes) {
      const html = n.descriptionHtml ?? ''; const s = kalipSayilari(html);
      if (s.urunBasligi + s.shopifyAciklama + s.gorsellerdeHerhangi > 0) yield { id: n.id, handle: n.handle, html };
    }
    after = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
  } while (after);
}

const ozet = await icBaslikCalistir(hedefler(), {
  oku: async (id) => (await gql<{ product: { descriptionHtml: string | null } | null }>('query($id:ID!){product(id:$id){descriptionHtml}}', { id })).product?.descriptionHtml ?? null,
  yaz: async (id, html) => {
    const m: { productUpdate: { userErrors: Array<{ message: string }> } } = await gql('mutation($p:ProductUpdateInput!){productUpdate(product:$p){userErrors{field message}}}', { p: { id, descriptionHtml: html } });
    const e = m.productUpdate.userErrors; return e.length ? { ok: false, hata: e.map((x) => x.message).join('; ') } : { ok: true };
  },
  kutuk: (s: KutukSatiri) => appendFileSync(kutukYolu, JSON.stringify({ ts: new Date().toISOString(), ...s }) + '\n'),
}, { uygula });
console.log(JSON.stringify({ kip: uygula ? 'uygula' : 'dry-run', kutuk: kutukYolu, ozet }, null, 1));
process.exit(ozet.hata > 0 ? 1 : 0);
