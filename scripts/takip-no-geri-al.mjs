#!/usr/bin/env node
/**
 * GERİ ALMA — takip-no-zpl-geri-yaz.mjs'in yazdığı değerleri yedekten döndürür.
 *
 * Yedek dosyası yazma anından ÖNCE üretilir (sipariş no + o anki tracking_number
 * + zaman damgası). Bu betik her satır için WHERE'e YENİ değeri koyar: yalnız
 * bizim yazdığımız değer duruyorsa geri alır, arada başka bir iş yazdıysa
 * dokunmaz.
 *
 * KULLANIM
 *   node geri-al.mjs <yedek.json>            # KURU KOŞU
 *   node geri-al.mjs <yedek.json> --apply    # geri alır
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const dosya = process.argv[2];
const YAZ = process.argv.includes('--apply');
if (!dosya) { console.error('kullanım: node geri-al.mjs <yedek.json> [--apply]'); process.exit(1); }

const psql = (sql) => execFileSync('psql', [process.env.DATABASE_URL, '-At', '-F', '\u0001', '-c', sql],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

const yedek = JSON.parse(readFileSync(dosya, 'utf8'));
console.log(`Yedek: ${dosya} · alındığı an: ${yedek.alindi} · satır: ${yedek.satirlar.length}`);
console.log(`KİP: ${YAZ ? 'GERİ ALMA (--apply)' : 'KURU KOŞU'}\n`);
console.log('SİPARİŞ    ŞU ANKİ      → GERİ YAZILACAK (yedekteki)');

let sayac = 0;
for (const s of yedek.satirlar) {
  const simdiki = psql(`select coalesce(tracking_number,'') from fulfillments where id='${s.id}'`).trim();
  const durum = simdiki === s.eski ? 'ZATEN ESKİ HÂLİNDE' : `${simdiki} → ${s.eski}`;
  console.log(`${s.siparis.padEnd(10)} ${durum}`);
  if (!YAZ || simdiki === s.eski) continue;
  const n = psql(`with u as (update fulfillments set tracking_number='${s.eski}', updated_at=now()
                 where id='${s.id}' and tracking_number='${simdiki}' returning 1) select count(*) from u`).trim();
  sayac += Number(n);
}
console.log(YAZ ? `\nGeri alınan satır: ${sayac}` : '\nKuru koşu. Geri almak için --apply.');
