/**
 * #994831 · SSS cevap düzeltme — mevcut bir cevabı ürünün GÜNCEL açıklamasındaki kaynaklı değere çeker (EC2'de koşar).
 *
 *   cd /var/www/viamood && set -a && . ./.env.production && set +a
 *   npx tsx scripts/sss-duzelt.mts <girdi.jsonl>             # DRY-RUN (varsayılan) — tek bayt yazmaz
 *   npx tsx scripts/sss-duzelt.mts <girdi.jsonl> --uygula    # yazar: DB `urun_sss` (tek satır) + `custom.sss` metafield
 *   isteğe bağlı: --kutuk=<yol.jsonl>   (her satırda ÖNCESİ küme — geri almak için)
 *
 * Kapılar: src/lib/sss-duzelt.ts (çivi: tests/sss-duzelt.test.ts). Yalnız ACTIVE ürün. Çıkış kodu: hata > 0 ise 1.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db/client.ts';
import { urunSss } from '../src/db/schema/urun-sss.ts';
import { duzeltCalistir, type KutukSatiri, type SssDuzeltGiris } from '../src/lib/sss-duzelt.ts';
import { sssSenkronla } from '../src/lib/urun-sss-shopify.ts';

const args = process.argv.slice(2);
const uygula = args.includes('--uygula');
const girdi = args.find((a) => !a.startsWith('--'));
if (!girdi || args.some((a) => a.startsWith('--') && a !== '--uygula' && !a.startsWith('--kutuk='))) { console.error('Kullanım: sss-duzelt.mts <girdi.jsonl> [--uygula] [--kutuk=yol.jsonl]'); process.exit(2); }
const kutukYolu = args.find((a) => a.startsWith('--kutuk='))?.slice(8)
  || path.join(process.env.LOG_DIR || path.join(homedir(), '.viamood-log'), `sss-duzelt-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
mkdirSync(path.dirname(kutukYolu), { recursive: true });
const girisler = readFileSync(girdi, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as SssDuzeltGiris);

const domain = (process.env.SHOPIFY_STORE_DOMAIN ?? '').trim();
const token = (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? '').trim();
const surum = (process.env.SHOPIFY_API_VERSION ?? '2025-01').trim();
if (!domain || !token) { console.error('SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN eksik'); process.exit(2); }

const ozet = await duzeltCalistir(girisler, {
  mevcutOku: (handle) => db.select({ soru: urunSss.soru, cevap: urunSss.cevap, sira: urunSss.sira }).from(urunSss).where(eq(urunSss.urunHandle, handle)).orderBy(urunSss.sira),
  aciklamaOku: async (handle) => {
    const r = await fetch(`https://${domain}/admin/api/${surum}/graphql.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query: 'query($h:String!){productByHandle(handle:$h){status descriptionHtml}}', variables: { h: handle } }),
    });
    const p = ((await r.json()) as { data?: { productByHandle?: { status: string; descriptionHtml: string | null } | null } }).data?.productByHandle;
    return p && p.status === 'ACTIVE' ? (p.descriptionHtml ?? '') : null;
  },
  yaz: async (handle, sira, onceCevap, yeniCevap) => {
    const r = await db.update(urunSss).set({ cevap: yeniCevap, updatedAt: new Date() })
      .where(and(eq(urunSss.urunHandle, handle), eq(urunSss.sira, sira), eq(urunSss.cevap, onceCevap))).returning({ id: urunSss.id });
    if (r.length !== 1) throw new Error(`DB güncellemesi ${r.length} satıra dokundu (beklenen 1)`);
  },
  senkronla: async (handle, kayitlar) => {
    const r = await sssSenkronla(handle, kayitlar);
    if (r.ok && 'atlandi' in r) return { ok: false, hata: 'SSS_METAFIELD_SENKRON kapalı — vitrine aktarılmadı' };
    return r.ok ? { ok: true } : { ok: false, hata: r.hata };
  },
  kutuk: (s: KutukSatiri) => appendFileSync(kutukYolu, JSON.stringify({ ts: new Date().toISOString(), ...s }) + '\n'),
}, { uygula });
console.log(JSON.stringify({ kip: uygula ? 'uygula' : 'dry-run', girdi, kutuk: kutukYolu, ozet }, null, 1));
process.exit(ozet.hata > 0 || ozet.senkronHatasi > 0 ? 1 : 0);
