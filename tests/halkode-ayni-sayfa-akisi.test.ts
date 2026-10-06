/**
 * #991314 — DÖRDÜNCÜ NEGATİF KANIT: akış AYNI SAYFADA kalır.
 *
 * Kabul ölçütünün diğer üç ayağı depoda zaten çivili:
 *   (a) kart alanı log'da 0   → halkode-form-hp "kart verisi log'a yazılmıyor"
 *   (b) hata metninde 0       → halkode-kart-dogrula "red mesajı kart verisi İÇERMEZ"
 *   (c) kalıcı depolamada 0   → halkode-tema-kapi "kart alanları hiçbir yere yazılmaz"
 * (d) için AÇIK bir iddia YOKTU — ölçtüm: `window.open` / `target="_blank"` /
 * `location` sayımını tutan tek satır bile yoktu. Bu dosya o boşluğu kapatır.
 *
 * NEDEN ÖNEMLİ: Yunus purchase-link yolunu tam da bu yüzden REDDETTİ ("Paytr gibi
 * direk site içerisinde iframe gözükecekse yapalım"). Yani "aynı sayfada kalma"
 * bir tercih değil, kartın KABUL ŞARTI. Kapısı olmayan şart, bir sonraki
 * düzenlemede sessizce düşer.
 *
 * ⚠ EKLEME-ONLY: ürün kaynağına tek bayt dokunulmadı; yalnız okunur iddia.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KOK = path.resolve(__dirname, '..');
const oku = (p: string) => readFileSync(path.join(KOK, p), 'utf8');

/** Yorumlar SOYULUR: yasağı ANLATAN yorum yasağı ihlal etmiş sayılmasın. */
function kod(ham: string): string {
  return ham
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{%-?\s*comment[\s\S]*?endcomment\s*-?%\}/g, '')
    .replace(/(^|\s)\/\/\s.*$/gm, '$1');
}

const TEMA = kod(oku('tema-yamalari/via-checkout.liquid.halkode-form-hp'));
const CERCEVE = kod(oku('src/components/halkode/Halkode3DCerceve.tsx'));

describe('(d) akış AYNI SAYFADA — yeni sekme / yeni pencere YOK', () => {
  it('tema kart akışında `window.open` sayısı 0', () => {
    const n = (TEMA.match(/window\.open\s*\(/g) ?? []).length;
    expect(n, 'yeni pencere açmak müşteriyi siteden çıkarır — Yunus bu yüzden reddetti').toBe(0);
  });

  it('tema kart akışında `target="_blank"` sayısı 0', () => {
    const n = (TEMA.match(/target\s*=\s*["']?_blank/g) ?? []).length;
    expect(n).toBe(0);
  });

  it('3D çerçeve bileşeninde `window.open` ve `_blank` sayısı 0', () => {
    expect((CERCEVE.match(/window\.open\s*\(/g) ?? []).length).toBe(0);
    expect((CERCEVE.match(/target\s*=\s*["']?_blank/g) ?? []).length).toBe(0);
  });

  it('3D adımı ÇERÇEVEDE açılıyor (srcDoc), ayrı sayfaya çıkarılmıyor', () => {
    expect(CERCEVE, 'srcDoc düştüyse 3D ayrı sayfaya taşınmış olabilir').toContain('srcDoc=');
  });

  it('her gezinme AYNI SİTEYE göreli — müşteri dışarı çıkarılmıyor', () => {
    /**
     * ⚠ BU İDDİA DARALTILDI (ölçümle): ilk yazdığım hâli "kart akışında hiç
     * gezinme olmasın" diyordu ve KIRMIZI yandı. Ölçtüm — eşleşen tek çağrı
     *   window.location.replace('/pages/siparis-alindi?order=…')
     * yani sipariş TAMAMLANDIKTAN sonraki teşekkür dönüşü. O meşru ve kart
     * adımında değil. Ölçütün gerçek anlamı "hiç gezinme yok" değil,
     * MÜŞTERİ SİTEDEN ÇIKARILMIYOR — purchase-link yolu tam da bunu ihlal
     * ettiği için Yunus tarafından reddedilmişti. Doğru kapı budur.
     */
    const hedefler = [...TEMA.matchAll(/location\s*(?:\.(?:replace|assign)\s*\(|\.href\s*=|=)\s*([^;]{0,80})/g)]
      .map((m) => m[1]!.trim());
    expect(hedefler.length, 'hiç gezinme bulunamadı — kalıp bozulmuş olabilir').toBeGreaterThan(0);
    for (const h of hedefler) {
      expect(h, `site DIŞINA gezinme: ${h}`).not.toMatch(/^['"`]https?:/);
      expect(h, `protokolsüz dış adres: ${h}`).not.toMatch(/^['"`]\/\//);
    }
  });

  it('DEĞİŞMEZ: 3D sonucu çerçeveden postMessage ile dönüyor (sayfa değişimiyle değil)', () => {
    expect(CERCEVE).toMatch(/addEventListener\(\s*['"]message['"]/);
  });
});

describe('#76 alanları korunmuş mu — 3D Secure + taksit', () => {
  const MARKUP = oku('tema-yamalari/via-checkout.liquid.halkode-form-hp');

  it('taksit rolleri duruyor (taksit · liste · satır · banka)', () => {
    for (const rol of ['taksit', 'taksit-liste', 'taksit-satir', 'taksit-banka']) {
      expect(MARKUP, `taksit rolü düştü: ${rol}`).toContain(`data-hk="${rol}"`);
    }
  });

  it('3D Secure anlatımı ekranda duruyor', () => {
    expect(MARKUP).toMatch(/3D\s*Secure/i);
  });

  it('dört kart alanı rolü duruyor (ad · no · skt · cvv)', () => {
    for (const rol of ['ad', 'no', 'skt', 'cvv']) {
      expect(MARKUP, `kart alanı düştü: ${rol}`).toContain(`data-hk="${rol}"`);
    }
  });
});
