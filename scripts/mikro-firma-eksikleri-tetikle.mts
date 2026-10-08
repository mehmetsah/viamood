/**
 * #993095 — 17 Eylül'den bu yana ANA FİRMA (VIA) bacağı eksik kalan siparişleri yeniden tetikler.
 *
 * ÖN KOŞUL (#992928): `syncOrderToMikro` girişindeki KOŞULSUZ 'approved' erken çıkışı
 * kaldırılmış olmalı. O erken çıkış dururken bu betik HİÇBİR İŞE YARAMAZ — her çağrı
 * ilk satırda geri dönüyordu (bu yüzden 17 Eylül'den beri biriken siparişler VIA'ya
 * aktarılamadı). Çivi: tests/mikro-firma-bacagi-mutabakat.test.ts
 *
 * NE YAPAR: aradepo bacağı tamam ('approved') ama firma bacağının tamam olduğunun
 * kanıtı olmayan siparişleri sırayla `syncOrderToMikro` ile mutabakat eder.
 * `pushToFirmaDb` kendi içinde `sip_evrakno_seri` sorgusu yapan IDEMPOTENT bir
 * fonksiyondur: evrak VIA'da zaten varsa dokunmaz. Aradepo evrağı bu yolda
 * TEKRAR YAZILMAZ (mutabakat dalında `siparisEkle` yok) → çift evrak riski yok.
 *
 * Kullanım (sunucuda, repo kökünden):
 *   set -a && source .env.production && set +a
 *   ./node_modules/.bin/tsx scripts/mikro-firma-eksikleri-tetikle.mts --dry             # SADECE SAY, yazma
 *   ./node_modules/.bin/tsx scripts/mikro-firma-eksikleri-tetikle.mts --from 2026-09-17 # gerçek
 *
 * ⚠ --dry VARSAYILANDIR. Gerçek koşum için --yaz bayrağı ZORUNLU; bu betik Mikro'ya
 *   YAZAR ve geri alınamaz, o yüzden koşturma kararı SAHİBİNDEDİR (#992928 kısıtı).
 */
import { and, asc, eq, gte } from 'drizzle-orm';

const { db } = await import('@/db/client');
const { orders } = await import('@/db/schema');
const { syncOrderToMikro } = await import('@/lib/server/mikro-sync');

const argv = process.argv.slice(2);
const yaz = argv.includes('--yaz');
const bekleMs = Number(argv.find((a) => a.startsWith('--bekle='))?.split('=')[1] ?? 400);
const fromArg = argv[argv.indexOf('--from') + 1];
const from = new Date(/^\d{4}-\d{2}-\d{2}$/.test(fromArg ?? '') ? `${fromArg}T00:00:00Z` : '2026-09-17T00:00:00Z');

console.log(`[mikro-firma-tetikle] kip=${yaz ? 'GERÇEK (Mikro\'ya YAZAR)' : 'DRY (yazmaz)'} · from=${from.toISOString().slice(0, 10)}`);

const adaylar = await db
  .select({
    id: orders.id,
    ad: orders.shopifyOrderName,
    seri: orders.mikroEvrakSeri,
    hata: orders.mikroError,
    tarih: orders.placedAt,
  })
  .from(orders)
  .where(and(eq(orders.mikroSyncStatus, 'approved'), gte(orders.placedAt, from)))
  .orderBy(asc(orders.placedAt));

console.log(`[mikro-firma-tetikle] aradepo'da ONAYLI ve ${from.toISOString().slice(0, 10)} sonrası sipariş: ${adaylar.length}`);
if (!yaz) {
  for (const a of adaylar.slice(0, 20)) {
    console.log(`  · ${a.ad ?? a.id} · ${a.tarih.toISOString().slice(0, 10)} · seri=${a.seri ?? '-'}${a.hata ? ` · hata=${a.hata}` : ''}`);
  }
  if (adaylar.length > 20) console.log(`  … +${adaylar.length - 20} sipariş daha`);
  console.log('[mikro-firma-tetikle] DRY bitti — hiçbir şey yazılmadı. Gerçek koşum: --yaz');
  process.exit(0);
}

let tamam = 0;
let dusen = 0;
for (const a of adaylar) {
  try {
    const r = await syncOrderToMikro(a.id);
    const firmaOk = r.ok && (r as { firma?: { ok: boolean; error?: string } }).firma?.ok !== false;
    if (firmaOk) {
      tamam += 1;
      console.log(`  ✓ ${a.ad ?? a.id}`);
    } else {
      dusen += 1;
      const hata = (r as { firma?: { error?: string }; error?: string }).firma?.error ?? (r as { error?: string }).error;
      console.error(`  ✗ ${a.ad ?? a.id} · ${hata}`);
    }
  } catch (e) {
    dusen += 1;
    console.error(`  ✗ ${a.ad ?? a.id} · istisna:`, e);
  }
  // Mikro API'sini boğmamak için nazik aralık
  if (bekleMs > 0) await new Promise((r) => setTimeout(r, bekleMs));
}

console.log(`[mikro-firma-tetikle] BİTTİ · tamam=${tamam} · düşen=${dusen} · toplam=${adaylar.length}`);
console.log('[mikro-firma-tetikle] Düşenlerin sebebi orders.mikro_error sütununa yazıldı (#992928).');
process.exit(dusen > 0 ? 1 : 0);
