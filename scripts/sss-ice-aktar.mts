/**
 * #994831 · Ürün SSS toplu içe aktarma — sunucuda (EC2) koşar; DB + Shopify erişimi env'den.
 *
 *   cd /var/www/viamood && set -a && . ./.env.production && set +a
 *   npx tsx scripts/sss-ice-aktar.mts <girdi.jsonl>             # DRY-RUN (varsayılan) — tek bayt yazmaz
 *   npx tsx scripts/sss-ice-aktar.mts <girdi.jsonl> --uygula    # yazar: DB `urun_sss` + `custom.sss` metafield
 *   isteğe bağlı: --kutuk=<yol.jsonl>  (varsayılan: $LOG_DIR ya da ~/.viamood-log altında tarih damgalı dosya)
 *
 * Karar mantığı TEK YERDE: src/lib/urun-sss-ice-aktar.ts (çivi: tests/urun-sss-ice-aktar.test.ts).
 * Bu dosya yalnız bağımlılıkları bağlar. `--uygula` yoksa `yaz`/`senkronla` hiç çağrılmaz.
 * ⛔ Toplu yazma müşteriye görünen ürün sayfasını değiştirir — koşmadan önce sahibin onayı gerekir.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.ts';
import { urunSss } from '../src/db/schema/urun-sss.ts';
import { sssIceAktar, type KutukSatiri } from '../src/lib/urun-sss-ice-aktar.ts';
import { handleGid, sssSenkronla } from '../src/lib/urun-sss-shopify.ts';

const args = process.argv.slice(2);
const girdi = args.find((a) => !a.startsWith('--'));
const uygula = args.includes('--uygula');
const bilinmeyen = args.filter((a) => a.startsWith('--') && a !== '--uygula' && !a.startsWith('--kutuk='));
if (!girdi || bilinmeyen.length) {
  console.error('Kullanım: sss-ice-aktar.mts <girdi.jsonl> [--uygula] [--kutuk=yol.jsonl]');
  process.exit(2);
}
const kutukYolu = args.find((a) => a.startsWith('--kutuk='))?.slice(8)
  || path.join(process.env.LOG_DIR || path.join(homedir(), '.viamood-log'), `sss-ice-aktar-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
mkdirSync(path.dirname(kutukYolu), { recursive: true });

const satirlar = readFileSync(girdi, 'utf8').split('\n');
const ozet = await sssIceAktar(
  satirlar,
  {
    mevcutOku: (handle) => db.select({ soru: urunSss.soru, cevap: urunSss.cevap }).from(urunSss)
      .where(eq(urunSss.urunHandle, handle)).orderBy(urunSss.sira),
    urunVarMi: async (handle) => Boolean(await handleGid(handle)),
    yaz: async (handle, kayitlar) => {
      await db.transaction(async (tx) => {
        await tx.insert(urunSss).values(kayitlar.map((k) => ({ urunHandle: handle, soru: k.soru, cevap: k.cevap, sira: k.sira })));
      });
    },
    senkronla: async (handle, kayitlar) => {
      const r = await sssSenkronla(handle, kayitlar);
      if (r.ok && 'atlandi' in r) return { ok: false, hata: 'SSS_METAFIELD_SENKRON kapalı — vitrine aktarılmadı' };
      return r.ok ? { ok: true } : { ok: false, hata: r.hata };
    },
    kutuk: (s: KutukSatiri) => appendFileSync(kutukYolu, JSON.stringify({ ts: new Date().toISOString(), ...s }) + '\n'),
  },
  { uygula },
);
console.log(JSON.stringify({ kip: uygula ? 'uygula' : 'dry-run', kutuk: kutukYolu, ozet }, null, 1));
process.exit(ozet.hata > 0 ? 1 : 0);
