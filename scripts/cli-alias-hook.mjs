/**
 * CLI ALIAS ÇÖZÜCÜ (#991465) — `@/…` yollarını Node'un kendi çözücüsüne tanıtır.
 *
 * NİYE VAR: `scripts/halkode-*.ts` betikleri Next OLMADAN, düz `node` ile koşuyor.
 * Next `@/lib/settings/store` gibi yolları derleme anında çözüyor; düz Node çözemiyor.
 * Sonuç ÖLÇÜLDÜ (#991465, 30 Eyl): `client.ts` içindeki `paymentSettings()` iki yolu da
 * (`@/lib/settings/store` ve uzantısız `../settings/store`) yükleyemiyor, catch SESSİZ
 * olduğu için ayarlar `{}` dönüyor ve araç DB'deki CANLI kimlikleri HİÇ göremeden
 * `.env.local`'deki TEST kimliğine düşüyor. Yani kuru koşu yanlış ortamı ölçüyordu.
 *
 * NİYE BÖYLE ÇÖZÜLDÜ: alternatif, uygulama kodundaki onlarca `@/…` import'unu
 * göreli+uzantılı hâle getirmekti — o, Next paketleyicisini de ilgilendiren geniş ve
 * riskli bir değişiklik olurdu. Bu çözücü YALNIZ CLI koşusunda devreye girer
 * (`node --import ./scripts/cli-alias.mjs …`); uygulama kodu ve Next derlemesi
 * HİÇ etkilenmez — tek bayt değişmez.
 *
 * Eşlemeler tsconfig.json `compilerOptions.paths` ile birebir aynı tutulur:
 *   @/*  → src/*     ·  @db/* → src/db/*  ·  @lib/* → src/lib/*
 */
import { statSync } from 'node:fs';
import { dirname, resolve as yolBirlestir } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KOK = dirname(dirname(fileURLToPath(import.meta.url)));
const ESLEME = [
  ['@/', 'src/'],
  ['@db/', 'src/db/'],
  ['@lib/', 'src/lib/'],
];
// Uzantısız yazılmış TS import'ları için sırayla denenir (Next bunu kendi yapıyordu).
const UZANTILAR = ['', '.ts', '.tsx', '.mts', '.js', '/index.ts', '/index.tsx', '/index.js'];

export function resolve(belirtec, baglam, sonraki) {
  for (const [onek, hedef] of ESLEME) {
    if (!belirtec.startsWith(onek)) continue;
    const taban = yolBirlestir(KOK, hedef + belirtec.slice(onek.length));
    for (const ek of UZANTILAR) {
      const aday = taban + ek;
      // DOSYA olmalı — çıplak dizin ("…/src/db/schema") Node'da "Directory import
      // is not supported" ile düşer; bu yüzden isFile() şart, existsSync YETMEZ.
      let dosyaMi = false;
      try { dosyaMi = statSync(aday).isFile(); } catch { dosyaMi = false; }
      if (dosyaMi) return { url: pathToFileURL(aday).href, shortCircuit: true };
    }
    // Eşleşti ama dosya yok: sessizce geçme — çağıran yanlış ortama düşmesin diye BAĞIR.
    throw new Error(`[cli-alias] "${belirtec}" çözülemedi; denenen taban: ${taban}`);
  }

  // GÖRELİ YOLLAR — uygulama kodu TS alışkanlığıyla uzantısız yazıyor
  // (`import * as schema from './schema'`). Next bunu çözüyor, düz Node çözemiyor:
  // dizine denk gelince "Directory import is not supported" ile düşer. ÖLÇÜLDÜ (#991465):
  // `src/db/client.ts:3` tam olarak buna takılıyordu ve hata `paymentSettings()` içindeki
  // sessiz catch'e düşüp ayarları `{}` yapıyordu. Önce Node'un kendi çözümünü deneriz;
  // yalnız O BAŞARISIZ OLURSA uzantı/indeks adaylarını sırayla yokluyoruz — yani
  // çalışan hiçbir çözümü ezmiyoruz.
  if ((belirtec.startsWith('./') || belirtec.startsWith('../')) && baglam.parentURL?.startsWith('file:')) {
    // ÖNDEN düzelt — `sonraki()`yi beklemek İŞE YARAMIYOR: Node dizin URL'sini
    // resolve'da BAŞARIYLA döndürüyor, "Directory import is not supported" hatasını
    // LOAD aşamasında atıyor; yani try/catch buraya hiç düşmüyor (ölçüldü #991465).
    let taban;
    try { taban = fileURLToPath(new URL(belirtec, baglam.parentURL)); } catch { taban = null; }
    if (taban) {
      let zatenDosya = false;
      try { zatenDosya = statSync(taban).isFile(); } catch { zatenDosya = false; }
      if (!zatenDosya) {
        for (const ek of UZANTILAR) {
          if (!ek) continue;
          const aday = taban + ek;
          let dosyaMi = false;
          try { dosyaMi = statSync(aday).isFile(); } catch { dosyaMi = false; }
          if (dosyaMi) return { url: pathToFileURL(aday).href, shortCircuit: true };
        }
      }
    }
  }

  return sonraki(belirtec, baglam);
}
