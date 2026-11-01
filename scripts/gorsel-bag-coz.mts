/**
 * #995648 · Ürün ↔ görsel bağını çözme — dosya SİLİNMEZ (Shopify Files'ta kalır). EC2'de koşar.
 *
 *   cd /var/www/viamood && set -a && . ./.env.production && set +a
 *   npx tsx scripts/gorsel-bag-coz.mts <girdi.jsonl>              # DRY-RUN (varsayılan) — tek bayt yazmaz
 *   npx tsx scripts/gorsel-bag-coz.mts <girdi.jsonl> --uygula     # fileUpdate(referencesToRemove) — yalnız bağ
 *   npx tsx scripts/gorsel-bag-coz.mts <girdi.jsonl> --geri-al    # fileUpdate(referencesToAdd) — bağı geri kurar
 *   isteğe bağlı: --kutuk=<yol.jsonl>   (ÖNCESİ galeri sırası yazılmadan bağ çözme koşmaz)
 *
 * ⛔ productDeleteMedia KULLANILMAZ (geri alınamaz siler). Kapılar: src/lib/gorsel-bag-coz.ts (çivi: tests/gorsel-bag-coz.test.ts).
 * Çıkış kodu: hata > 0 ya da iş durduysa 1.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { bagCozCalistir, geriAlCalistir, type Canli, type Giris, type KutukSatiri } from '../src/lib/gorsel-bag-coz.ts';

const args = process.argv.slice(2);
const uygula = args.includes('--uygula');
const geriAl = args.includes('--geri-al');
const girdi = args.find((a) => !a.startsWith('--'));
if (!girdi || (uygula && geriAl) || args.some((a) => a.startsWith('--') && a !== '--uygula' && a !== '--geri-al' && !a.startsWith('--kutuk='))) {
  console.error('Kullanım: gorsel-bag-coz.mts <girdi.jsonl> [--uygula | --geri-al] [--kutuk=yol.jsonl]'); process.exit(2);
}
const kutukYolu = args.find((a) => a.startsWith('--kutuk='))?.slice(8)
  || path.join(process.env.LOG_DIR || path.join(homedir(), '.viamood-log'), `gorsel-bag-coz-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
mkdirSync(path.dirname(kutukYolu), { recursive: true });
const girisler = readFileSync(girdi, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Giris);

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

type M = { id: string; image?: { url: string } | null; preview?: { image?: { url: string } | null } | null };
const oku = async (handle: string): Promise<Canli | null> => {
  const p = (await gql<{ productByHandle: { id: string; handle: string; featuredMedia: { id: string } | null; media: { nodes: M[] } } | null }>(
    'query($h:String!){productByHandle(handle:$h){id handle featuredMedia{id} media(first:100){nodes{id preview{image{url}} ... on MediaImage{image{url}}}}}}', { h: handle })).productByHandle;
  return p ? { urunId: p.id, handle: p.handle, anaGorsel: p.featuredMedia?.id ?? null, galeri: p.media.nodes.map((m) => ({ id: m.id, url: m.image?.url ?? m.preview?.image?.url ?? '' })) } : null;
};
const referans = (alan: 'referencesToRemove' | 'referencesToAdd') => async (mediaId: string, urunId: string) => {
  const m = await gql<{ fileUpdate: { userErrors: Array<{ message: string; code: string | null }> } }>(
    'mutation($f:[FileUpdateInput!]!){fileUpdate(files:$f){files{id fileStatus} userErrors{field message code}}}', { f: [{ id: mediaId, [alan]: [urunId] }] });
  const e = m.fileUpdate.userErrors;
  return e.length ? { ok: false as const, hata: e.map((x) => `${x.code ?? ''} ${x.message}`).join('; ') } : { ok: true as const };
};
const kutuk = (s: KutukSatiri) => appendFileSync(kutukYolu, JSON.stringify({ ts: new Date().toISOString(), ...s }) + '\n');

if (geriAl) {
  const oz = await geriAlCalistir(girisler, { oku, kutuk, bagKur: referans('referencesToAdd') });
  console.log(JSON.stringify({ kip: 'geri-al', girdi, kutuk: kutukYolu, ozet: oz }, null, 1));
  process.exit(oz.hata > 0 ? 1 : 0);
}
const ozet = await bagCozCalistir(girisler, {
  oku,
  dosya: async (mediaId) => {
    const n = (await gql<{ node: { fileStatus: string; image: { url: string } | null } | null }>(
      'query($id:ID!){node(id:$id){... on MediaImage{fileStatus image{url}}}}', { id: mediaId })).node;
    return n && n.fileStatus ? { fileStatus: n.fileStatus, url: n.image?.url ?? null } : null;
  },
  bagCoz: referans('referencesToRemove'),
  kutuk,
}, { uygula });
console.log(JSON.stringify({ kip: uygula ? 'uygula' : 'dry-run', girdi, kutuk: kutukYolu, ozet }, null, 1));
process.exit(ozet.hata > 0 || ozet.durdu ? 1 : 0);
