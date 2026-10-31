/**
 * #994831 · SSS soru düşürme — kural dışı (kargo/iade) soruyu GİZLER: DB satırı silinmez, `acik=false` + metafield senkronu (EC2'de koşar).
 *
 *   cd /var/www/viamood && set -a && . ./.env.production && set +a
 *   npx tsx scripts/sss-dusur.mts <girdi.jsonl>             # DRY-RUN (varsayılan) — tek bayt yazmaz
 *   npx tsx scripts/sss-dusur.mts <girdi.jsonl> --uygula    # yazar: DB `urun_sss.acik=false` (tek satır) + `custom.sss` metafield
 *   isteğe bağlı: --kutuk=<yol.jsonl>   (ÖNCESİ küme yazılmadan DB'ye yazma koşmaz — geri alma: aynı satırda acik=true + senkron)
 *
 * Kapılar: src/lib/sss-dusur.ts (çivi: tests/sss-dusur.test.ts). Çıkış kodu: hata ya da senkron hatası > 0 ise 1.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db/client.ts';
import { urunSss } from '../src/db/schema/urun-sss.ts';
import { dusurCalistir, type KutukSatiri, type SssDusurGiris } from '../src/lib/sss-dusur.ts';
import { sssSenkronla } from '../src/lib/urun-sss-shopify.ts';

const args = process.argv.slice(2);
const uygula = args.includes('--uygula');
const girdi = args.find((a) => !a.startsWith('--'));
if (!girdi || args.some((a) => a.startsWith('--') && a !== '--uygula' && !a.startsWith('--kutuk='))) { console.error('Kullanım: sss-dusur.mts <girdi.jsonl> [--uygula] [--kutuk=yol.jsonl]'); process.exit(2); }
const kutukYolu = args.find((a) => a.startsWith('--kutuk='))?.slice(8)
  || path.join(process.env.LOG_DIR || path.join(homedir(), '.viamood-log'), `sss-dusur-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
mkdirSync(path.dirname(kutukYolu), { recursive: true });
const girisler = readFileSync(girdi, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as SssDusurGiris);

const ozet = await dusurCalistir(girisler, {
  oku: (handle) => db.select({ soru: urunSss.soru, cevap: urunSss.cevap, sira: urunSss.sira, acik: urunSss.acik }).from(urunSss).where(eq(urunSss.urunHandle, handle)).orderBy(urunSss.sira),
  gizle: async (handle, sira, soru, onceCevap) => {
    const r = await db.update(urunSss).set({ acik: false, updatedAt: new Date() })
      .where(and(eq(urunSss.urunHandle, handle), eq(urunSss.sira, sira), eq(urunSss.soru, soru), eq(urunSss.cevap, onceCevap), eq(urunSss.acik, true))).returning({ id: urunSss.id });
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
