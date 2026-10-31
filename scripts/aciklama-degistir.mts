/**
 * #994831 · Açıklaması BAŞKA ÜRÜNÜ anlatan ürünler — yanlış açıklama kaldırılır, kaynaklı metin yazılır (EC2'de koşar).
 *
 *   cd /var/www/viamood && set -a && . ./.env.production && set +a
 *   npx tsx scripts/aciklama-degistir.mts <girdi.jsonl>              # DRY-RUN (varsayılan)
 *   npx tsx scripts/aciklama-degistir.mts <girdi.jsonl> --uygula     # yazar: productUpdate(descriptionHtml)
 *   isteğe bağlı: --kutuk=<yol.jsonl>   (her satırda ÖNCESİ HTML — geri almak için)
 *
 * Girdi satırları ve kapılar: src/lib/aciklama-degistir.ts (çivi: tests/aciklama-degistir.test.ts). Yalnız ACTIVE ürün.
 * Çıkış kodu: hata > 0 ise 1.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { degistirCalistir, type Giris, type KutukSatiri, type OlcuGiris, type YarimGiris } from '../src/lib/aciklama-degistir.ts';

const args = process.argv.slice(2);
const uygula = args.includes('--uygula');
const girdi = args.find((a) => !a.startsWith('--'));
if (!girdi || args.some((a) => a.startsWith('--') && a !== '--uygula' && !a.startsWith('--kutuk='))) { console.error('Kullanım: aciklama-degistir.mts <girdi.jsonl> [--uygula] [--kutuk=yol.jsonl]'); process.exit(2); }
const kutukYolu = args.find((a) => a.startsWith('--kutuk='))?.slice(8)
  || path.join(process.env.LOG_DIR || path.join(homedir(), '.viamood-log'), `aciklama-degistir-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
mkdirSync(path.dirname(kutukYolu), { recursive: true });
const girisler = readFileSync(girdi, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Giris | YarimGiris | OlcuGiris);

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

const ozet = await degistirCalistir(girisler, {
  bul: async (handle) => {
    const p = (await gql<{ productByHandle: { id: string; handle: string; status: string; descriptionHtml: string | null } | null }>(
      'query($h:String!){productByHandle(handle:$h){id handle status descriptionHtml}}', { h: handle })).productByHandle;
    return p && p.status === 'ACTIVE' ? { id: p.id, handle: p.handle, html: p.descriptionHtml ?? '' } : null;
  },
  oku: async (id) => (await gql<{ product: { descriptionHtml: string | null } | null }>('query($id:ID!){product(id:$id){descriptionHtml}}', { id })).product?.descriptionHtml ?? null,
  yaz: async (id, html) => {
    const m: { productUpdate: { userErrors: Array<{ message: string }> } } = await gql('mutation($p:ProductUpdateInput!){productUpdate(product:$p){userErrors{field message}}}', { p: { id, descriptionHtml: html } });
    const e = m.productUpdate.userErrors; return e.length ? { ok: false, hata: e.map((x) => x.message).join('; ') } : { ok: true };
  },
  kutuk: (s: KutukSatiri) => appendFileSync(kutukYolu, JSON.stringify({ ts: new Date().toISOString(), ...s }) + '\n'),
}, { uygula });
console.log(JSON.stringify({ kip: uygula ? 'uygula' : 'dry-run', girdi, kutuk: kutukYolu, ozet }, null, 1));
process.exit(ozet.hata > 0 ? 1 : 0);
