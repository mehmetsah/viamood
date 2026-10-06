/**
 * ÇİVİ — abonelikten çıkma (#991691). Yasal zorunluluk, o yüzden NEGATİF iddialar ağırlıkta.
 *
 * ÖLÇÜLEN EKSİK (27 Eyl 2026): 9 mail şablonunun HİÇBİRİNDE çıkış linki yoktu
 * (`unsubscribe|abonelik` araması 0) ve gönderim için hiç log tutulmuyordu.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  cikisZorunluMu, cikisEngelliyorMu, cikisSorgusu, cikisLinki,
  jetonDogrula, imzala, cikisAltBilgisi, cikisBasliklari, CIKIS_ZORUNLU_TIPLER,
} from '../src/lib/email/abonelik';

const TABAN = 'https://hesap.viamood.com.tr';
const MAIL = 'Deneme.Kisi@Example.COM';
let yedek: string | undefined;
beforeEach(() => { yedek = process.env.AUTH_SECRET; process.env.AUTH_SECRET = 'civi-sahte-sir-991691'; });
afterEach(() => { if (yedek === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = yedek; });

describe('HANGİ mailde zorunlu — işlemsel engellenmez', () => {
  it('pazarlama ve duyuru ZORUNLU', () => {
    expect(cikisZorunluMu('pazarlama')).toBe(true);
    expect(cikisZorunluMu('duyuru')).toBe(true);
    expect(CIKIS_ZORUNLU_TIPLER).toEqual(['pazarlama', 'duyuru']);
  });

  it('işlemsel mail ZORUNLU DEĞİL ve çıkış listesi onu ENGELLEMEZ', () => {
    // Engellerse müşteri kendi siparişinin/kargosunun bilgisini alamaz.
    expect(cikisZorunluMu('islemsel')).toBe(false);
    expect(cikisEngelliyorMu('islemsel'), 'işlemsel mail engellendi — sipariş onayı gitmez').toBe(false);
  });
});

describe('JETON — başkasının adresi tek tıkla düşürülemez', () => {
  it('geçerli jeton e-postayı küçük harfe indirerek döner', () => {
    const q = new URLSearchParams(cikisSorgusu(MAIL));
    expect(jetonDogrula(q.get('e'), q.get('s'))).toBe('deneme.kisi@example.com');
  });

  it('İMZA YOKSA reddedilir', () => {
    const q = new URLSearchParams(cikisSorgusu(MAIL));
    expect(jetonDogrula(q.get('e'), null)).toBeNull();
    expect(jetonDogrula(q.get('e'), '')).toBeNull();
  });

  it('BAŞKA e-posta kendi imzasıyla değil, HEDEFİN imzasıyla gelmezse reddedilir', () => {
    const benim = new URLSearchParams(cikisSorgusu('ben@example.com'));
    const kurban = Buffer.from('kurban@example.com', 'utf8').toString('base64url');
    // Kendi imzamı başkasının adresiyle eşleştirmeye çalışıyorum:
    expect(jetonDogrula(kurban, benim.get('s')), 'başkasının adresi düşürülebiliyor').toBeNull();
  });

  it('imza tek karakter değişse reddedilir', () => {
    const q = new URLSearchParams(cikisSorgusu(MAIL));
    const s = q.get('s')!;
    const bozuk = (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
    expect(jetonDogrula(q.get('e'), bozuk)).toBeNull();
  });

  it('SIR TANIMSIZSA hiçbir şey doğrulanmaz (imzasız uç = herkes herkesi silebilir)', () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    const e = Buffer.from('x@y.com', 'utf8').toString('base64url');
    expect(imzala('x@y.com')).toBe('');
    expect(jetonDogrula(e, 'herhangi')).toBeNull();
  });

  it('e-posta olmayan/bozuk base64 reddedilir', () => {
    expect(jetonDogrula('!!!bozuk!!!', 'x')).toBeNull();
    const dusuk = Buffer.from('epostadegil', 'utf8').toString('base64url');
    expect(jetonDogrula(dusuk, imzala('epostadegil'))).toBeNull();
  });
});

describe('ALT BİLGİ ve BAŞLIKLAR', () => {
  it('alt bilgi tıklanabilir https link taşır ve düz e-posta SIZDIRMAZ', () => {
    const h = cikisAltBilgisi(TABAN, MAIL);
    expect(h).toContain('https://hesap.viamood.com.tr/api/email/abonelik-cik?');
    expect(h).toMatch(/Abonelikten çık/);
    expect(h, 'link sorgu dizesinde düz e-posta var').not.toContain('deneme.kisi@example.com');
  });

  it('RFC 8058 tek-tık başlıkları üretiliyor', () => {
    const b = cikisBasliklari(TABAN, MAIL);
    expect(b['List-Unsubscribe']).toMatch(/^<https:\/\/.+>$/);
    expect(b['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('link mobilde açılır — localhost/file:/data: DEĞİL', () => {
    const l = cikisLinki(TABAN, MAIL);
    expect(l.startsWith('https://')).toBe(true);
    expect(l).not.toMatch(/localhost|file:|data:/);
  });
});

describe('ÜRÜN KAYNAĞI — kapı gerçekten bağlı mı', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const KOK = path.resolve(__dirname, '..');
  const SENDER = fs.readFileSync(path.join(KOK, 'src/lib/email/sender.ts'), 'utf8');
  const WELCOME = fs.readFileSync(path.join(KOK, 'src/lib/welcome-signup.ts'), 'utf8');

  it('sendEmail izin kapısını KOŞUL olarak çağırıyor', () => {
    // ⚠ ÖLÇÜLDÜ: önce yalnız "kaynakta cikisEngelliyorMu geçiyor mu" diye
    // bakıyordu ve KÖRDÜ — kapıyı `if (false)` yapan mutasyon çıkış 0 verdi,
    // çünkü aynı ad çıkış-linki dalında da geçiyor. İddia artık KOŞULUN kendisini
    // ölçüyor: engelleme dalı `abonelikCikmisMi`'yi await ile bir if içinde çağırmalı.
    expect(SENDER).toMatch(/if\s*\(\s*cikisEngelliyorMu\(tip\)[^)]*&&[^)]*await\s+abonelikCikmisMi/);
    // Engellenen gönderim ok:false dönmeli — sessizce gönderilmiş sayılmamalı.
    const i = SENDER.indexOf('await abonelikCikmisMi');
    const dal = SENDER.slice(i, i + 420);
    expect(dal).toMatch(/ok:\s*false/);
    expect(dal).toMatch(/kanal:\s*'engellendi'/);
  });

  it('sendEmail her sonucu LOGLUYOR', () => {
    expect(SENDER).toMatch(/kayitYaz\(/);
    expect(SENDER).toMatch(/bitir\(await resendIle/);
    expect(SENDER).toMatch(/bitir\(await smtpIle/);
  });

  it('log yazımı gönderimi DÜŞÜRMEZ (yutulan hata)', () => {
    // Gövde sınırı: sonraki `export` bildirimine kadar. `\n}` ile kesmek YETMİYOR —
    // fonksiyon içindeki `values({...})` bloğu da `\n  }` ile kapanıyor ve gövde
    // catch'ten ÖNCE bitiyordu (ölçüldü: iddia yanlış yerde kırıldı).
    const i = SENDER.indexOf('async function kayitYaz');
    const govde = SENDER.slice(i, SENDER.indexOf('export async function sendEmail', i));
    expect(govde).toMatch(/catch\s*\{/);
    expect(govde, 'log hatası yukarı fırlatılıyor — mail gönderimi düşer').not.toMatch(/catch[^{]*\{[^}]*throw/);
  });

  it('hoş geldin indirimi PAZARLAMA olarak işaretli', () => {
    expect(WELCOME).toMatch(/tip:\s*'pazarlama'/);
    expect(WELCOME).toMatch(/sablon:\s*'welcomeDiscountEmail'/);
  });
});
