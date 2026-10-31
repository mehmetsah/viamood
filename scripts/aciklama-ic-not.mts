/**
 * #994995 · Müşteriye görünen iç notları onaylı TASLAKLA kaldırma — sunucuda (EC2) koşar; Shopify erişimi env'den.
 *
 *   cd /var/www/viamood && set -a && . ./.env.production && set +a
 *   npx tsx scripts/aciklama-ic-not.mts                 # DRY-RUN (varsayılan) — tek bayt yazmaz
 *   npx tsx scripts/aciklama-ic-not.mts --uygula        # yazar: productUpdate(descriptionHtml)
 *   isteğe bağlı: --manifest=<yol> (varsayılan veri/994995-aciklama/manifest.json) · --kutuk=<yol.jsonl>
 *
 * Karar ve kapılar TEK YERDE: src/lib/aciklama-ic-not.ts (çivi: tests/aciklama-ic-not.test.ts).
 * Çıkış kodu: hata > 0 ise 1 (damgalı kanca buna bakar; atlanan ürün hata sayılmaz).
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { taslakCalistir, type Is, type KutukSatiri } from '../src/lib/aciklama-ic-not.ts';

const args = process.argv.slice(2);
const uygula = args.includes('--uygula');
const bilinmeyen = args.filter((a) => a !== '--uygula' && !a.startsWith('--manifest=') && !a.startsWith('--kutuk='));
if (bilinmeyen.length) {
  console.error('Kullanım: aciklama-ic-not.mts [--uygula] [--manifest=yol.json] [--kutuk=yol.jsonl]');
  process.exit(2);
}
const manifestYolu = args.find((a) => a.startsWith('--manifest='))?.slice(11) || 'veri/994995-aciklama/manifest.json';
const kutukYolu = args.find((a) => a.startsWith('--kutuk='))?.slice(8)
  || path.join(process.env.LOG_DIR || path.join(homedir(), '.viamood-log'), `aciklama-ic-not-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
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

const dizin = path.dirname(manifestYolu);
const manifest = JSON.parse(readFileSync(manifestYolu, 'utf8')) as Array<{ handle: string; taslak: string; onceMd5: string }>;
const isler: Is[] = manifest.map((m) => ({ handle: m.handle, onceMd5: m.onceMd5, taslakHtml: readFileSync(path.join(dizin, m.taslak), 'utf8') }));

const ozet = await taslakCalistir(
  isler,
  {
    oku: async (handle) => {
      const d: { productByHandle: { id: string; descriptionHtml: string | null } | null } = await gql(
        'query($h:String!){productByHandle(handle:$h){id descriptionHtml}}', { h: handle });
      return d.productByHandle ? { id: d.productByHandle.id, html: d.productByHandle.descriptionHtml ?? '' } : null;
    },
    yaz: async (id, html) => {
      const m: { productUpdate: { userErrors: Array<{ message: string }> } } = await gql(
        'mutation($p:ProductUpdateInput!){productUpdate(product:$p){userErrors{field message}}}', { p: { id, descriptionHtml: html } });
      const e = m.productUpdate.userErrors;
      return e.length ? { ok: false, hata: e.map((x) => x.message).join('; ') } : { ok: true };
    },
    kutuk: (s: KutukSatiri) => appendFileSync(kutukYolu, JSON.stringify({ ts: new Date().toISOString(), ...s }) + '\n'),
  },
  { uygula },
);
console.log(JSON.stringify({ kip: uygula ? 'uygula' : 'dry-run', kutuk: kutukYolu, ozet }, null, 1));
process.exit(ozet.hata > 0 ? 1 : 0);
