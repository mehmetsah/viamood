#!/usr/bin/env node
/**
 * Sürat (kurye 456) gönderilerinde takip numarasını ETİKETTEN geri yazar.
 *
 * NEDEN VAR: KargoLab'in Sürat entegrasyonu barkodu yapısal alana
 * (`courrier_api.data.dongu.barkod` / `data.tracking_number`) KOYMUYOR; yalnız
 * ZPL etiket metninin içine gömüyor. Barkod bulunamayınca eski kod isteğe
 * koyduğumuz referansı (sipariş no) takip numarası sanıp yazmıştı — 23 Eyl 2026
 * ölçümünde 10 kayıt "#1056", "#1101" gibi sahte numaralarla duruyordu.
 *
 * ⚠ BU BETİK TEK SEFERLİK KURTARMADIR, KALICI ÇÖZÜM DEĞİLDİR.
 * ZPL bir yazdırma biçimidir, sözleşmeli API alanı değil. Kalıcı çözüm
 * KargoLab'in barkodu yapısal alanda döndürmesidir; uygulama kodu ZPL
 * ayrıştırmamalı (bkz. 5ceaa81 — barkod yoksa alan boş bırakılır).
 *
 * KULLANIM
 *   node scripts/takip-no-zpl-geri-yaz.mjs            # KURU KOŞU (varsayılan)
 *   node scripts/takip-no-zpl-geri-yaz.mjs --apply    # yazar (Mehmet Şah onayı şart)
 *
 * DB erişimi `psql "$DATABASE_URL"` üzerinden — ek bağımlılık istemez.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const YAZ = process.argv.includes('--apply');
const KURYE = '456';

/**
 * ZPL etiketinden kurye barkodunu çıkarır.
 *
 * Barkod komutu: `^BCN,,Y,N` + `^FD>:01252030791^FS`
 * `>:` ZPL'in Code128 subset-C geçiş dizisidir, numaranın parçası DEĞİLDİR.
 *
 * ⚠ 11 HANE, 13 DEĞİL: ilk ölçümde `[0-9]{13}` aranmış ve komşu bir alandaki
 * 14 haneli sayı yanlışlıkla kesilerek barkod sanılmıştı. Doğru kaynak yalnız
 * `^BC` komutunun kendi `^FD` alanıdır — sayfadaki başka bir rakam dizisi değil.
 */
export function zplBarkodCikar(zpl) {
  if (typeof zpl !== 'string' || !zpl) return null;
  const m = /\^BC[^^]*\^FD(?:>[:;.])?([0-9]+)\^FS/.exec(zpl);
  if (!m) return null;
  const no = m[1];
  // Sürat barkodu 11 hane. Uzunluk tutmuyorsa KABUL ETME — yanlış takip
  // numarası, boş bırakmaktan da sahte numaradan da kötüdür (müşteriyi
  // başkasının gönderisine götürür).
  return /^[0-9]{11}$/.test(no) ? no : null;
}

function psql(sql) {
  return execFileSync('psql', [process.env.DATABASE_URL, '-At', '-F', '\u0001', '-c', sql], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * ANA AKIŞ — yalnız betik DOĞRUDAN çalıştırıldığında koşar.
 *
 * ⚠ Kapı şart: `zplBarkodCikar` birim testinden import ediliyor; kapı olmasa
 * import anında prod DB sorgusu tetiklenirdi (ölçüldü: test 'database
 * undefined' ile patladı).
 */
function main() {
  const SORGU = `
  select f.id, o.shopify_order_name, coalesce(f.tracking_number,''),
         replace(replace(f.metadata->'kargolabResponse'->'courrier_api'->>'zpl', chr(10),'~N'), chr(13),'~R')
  from fulfillments f join orders o on o.id = f.order_id
  where (f.metadata->'kargolabResponse'->'data'->>'courrier') = '${KURYE}'
    and (f.metadata->'kargolabResponse'->'courrier_api'->>'zpl') is not null
  order by f.created_at`;

  const satirlar = psql(SORGU).split('\n').filter((s) => s.includes('\u0001'));
  const uygun = [], atlanan = [];

  for (const satir of satirlar) {
    const [id, siparis, eski, zplHam] = satir.split('\u0001');
    const zpl = (zplHam ?? '').replaceAll('~N', '\n').replaceAll('~R', '\r');
    const yeni = zplBarkodCikar(zpl);

    // KAPI 1: barkod çıkarılamadı → dokunma.
    if (!yeni) { atlanan.push({ siparis, eski, sebep: 'ZPL’den 11 haneli barkod çıkmadı' }); continue; }
    // KAPI 2: mevcut değer ZATEN geçerli bir barkodsa dokunma (üzerine yazma yok).
    if (/^[0-9]{6,}$/.test(eski)) { atlanan.push({ siparis, eski, sebep: 'mevcut değer zaten geçerli' }); continue; }
    uygun.push({ id, siparis, eski, yeni });
  }

  // KAPI 3: çıkarılan numaralar benzersiz olmalı — aynı barkod iki siparişe
  // yazılırsa iki müşteri de yanlış gönderiyi takip eder.
  const sayim = new Map();
  for (const s of uygun) sayim.set(s.yeni, (sayim.get(s.yeni) ?? 0) + 1);
  const cakisan = [...sayim].filter(([, n]) => n > 1);

  console.log(`KİP: ${YAZ ? 'YAZMA (--apply)' : 'KURU KOŞU — veritabanına yazılmaz'}`);
  console.log(`Kurye ${KURYE} + ZPL'li kayıt: ${satirlar.length} · yazılabilir: ${uygun.length} · atlanan: ${atlanan.length}\n`);
  console.log('SİPARİŞ    ESKİ DEĞER   → ÇIKARILAN TAKİP NO');
  for (const s of uygun) console.log(`${s.siparis.padEnd(10)} ${s.eski.padEnd(12)} → ${s.yeni}`);
  for (const a of atlanan) console.log(`ATLANDI ${a.siparis} (${a.eski}) — ${a.sebep}`);

  if (cakisan.length) {
    console.error(`\n⛔ DUR: aynı barkod birden çok siparişte: ${cakisan.map(([b, n]) => `${b}×${n}`).join(', ')}`);
    process.exit(1);
  }
  if (!YAZ) { console.log('\nKuru koşu bitti. Yazmak için --apply (Mehmet Şah onayı gerekir).'); process.exit(0); }

  for (const s of uygun) {
    // Eski değer koşulu WHERE'de: betik iki kez koşarsa ya da arada başka bir
    // iş aynı satıra yazdıysa üzerine yazmaz.
    psql(`update fulfillments set tracking_number='${s.yeni}', updated_at=now()
          where id='${s.id}' and tracking_number='${s.eski}'`);
    console.log(`yazıldı: ${s.siparis} → ${s.yeni}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
