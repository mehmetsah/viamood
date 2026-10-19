/**
 * ÇİVİ — #994753 · R3: storefront köprü imzası İKİ UÇTA AYNI doğrulanır.
 *
 * ÖLÇÜLEN ARIZA (19 Eki 2026, Okan · P0-A): tema imzayı
 * `{{ customer.email | hmac_sha256: BRIDGE_KEY }}` ile HAM e-posta üzerinden
 * üretiyor. `addresses` ucu `hmac(email)` doğruluyordu, yeni `reviews`
 * doğrulayıcısı `hmac(email.trim().toLowerCase())`. Büyük harf içeren bir
 * e-posta için aynı imza bir uçta geçerli, ötekinde geçersizdi — ve sonuç
 * SESSİZDİ: `verifiedBuyer` hep false kalıyordu, hata görünmüyordu.
 */
import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { imzaGecerliMi, imzaAdaylari, EN_AZ_ANAHTAR_UZUNLUGU } from '@/lib/storefront/imza';

const ANAHTAR = 'a'.repeat(48);       // 48 > 32 ⇒ geçerli uzunluk
const ESKI = 'b'.repeat(48);
const imzala = (mesaj: string, key = ANAHTAR) =>
  createHmac('sha256', key).update(mesaj).digest('hex');

describe('#994753 R3 · tek doğrulama kuralı', () => {
  it('BÜYÜK HARFLİ e-posta: temanın ürettiği HAM imza geçerli sayılır', () => {
    const email = 'Musteri.Ad@Example.COM';
    // Bugünkü tema: downcase YOK, e-posta olduğu gibi imzalanıyor.
    expect(imzaGecerliMi(email, imzala(email), ANAHTAR)).toBe(true);
  });

  it('BÜYÜK HARFLİ e-posta: küçük harfe çevrilmiş imza DA geçerli sayılır', () => {
    const email = 'Musteri.Ad@Example.COM';
    // İleride temaya `| downcase` eklenirse kod değişikliği gerekmesin.
    expect(imzaGecerliMi(email, imzala(email.toLowerCase()), ANAHTAR)).toBe(true);
  });

  it('küçük harfli e-postada tek aday üretilir (gereksiz HMAC yok)', () => {
    expect(imzaAdaylari('a@b.com')).toEqual(['a@b.com']);
    expect(imzaAdaylari(' A@B.com ')).toEqual(['A@B.com', 'a@b.com']);
  });

  it('ROTASYON — eski anahtarla üretilmiş imza geçiş süresince kabul edilir', () => {
    const email = 'a@b.com';
    expect(imzaGecerliMi(email, imzala(email, ESKI), ANAHTAR, ESKI)).toBe(true);
    // Geçiş bitip STOREFRONT_BRIDGE_KEY_ESKI silinince AYNI imza REDDEDİLİR.
    expect(imzaGecerliMi(email, imzala(email, ESKI), ANAHTAR)).toBe(false);
  });

  it('NEGATİF — yanlış imza, bozuk hex, boş/kısa anahtar REDDEDİLİR', () => {
    const email = 'a@b.com';
    expect(imzaGecerliMi(email, imzala('baska@b.com'), ANAHTAR)).toBe(false);
    expect(imzaGecerliMi(email, 'zz', ANAHTAR)).toBe(false);
    expect(imzaGecerliMi(email, imzala(email), '')).toBe(false);
    expect(imzaGecerliMi(email, imzala(email), 'kisa')).toBe(false);
    expect(imzaGecerliMi(email, imzala(email), 'x'.repeat(EN_AZ_ANAHTAR_UZUNLUGU - 1))).toBe(false);
    expect(imzaGecerliMi('', imzala(''), ANAHTAR)).toBe(false);
    expect(imzaGecerliMi(email, null, ANAHTAR)).toBe(false);
  });
});

describe('#994753 R3 · iki uç AYNI kaynağı çağırır', () => {
  const oku = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');
  const ADRES = oku('src', 'app', 'api', 'v1', 'storefront', 'addresses', 'route.ts');
  const YORUM = oku('src', 'app', 'api', 'v1', 'storefront', 'reviews', 'route.ts');

  it('ikisi de @/lib/storefront/imza kullanır', () => {
    for (const src of [ADRES, YORUM]) {
      expect(src).toContain("from '@/lib/storefront/imza'");
      expect(src).toContain('imzaGecerliMi(email, sig, BRIDGE_KEY, eskiKopruAnahtari())');
    }
  });

  it('NEGATİF — adres ucunda ELLE HMAC karşılaştırması KALMADI', () => {
    // Eski kod burada kendi createHmac/timingSafeEqual'ını kuruyordu; ikinci bir
    // doğrulama kopyası kalırsa iki uç yine ayrışabilir.
    expect(ADRES).not.toContain("createHmac('sha256', BRIDGE_KEY)");
    expect(ADRES).not.toContain('crypto.timingSafeEqual');
    expect(ADRES).not.toContain("node:crypto");
  });

  it('R2 SINIRI — gömülü anahtar fallback’i bu turda KALDIRILMADI (sahip kapısı)', () => {
    // Rotasyon planı P0-A raporu §3. Fallback şimdi silinse prod anahtarsız kalır
    // (ölçüm: prod .env.production'da STOREFRONT_BRIDGE_KEY TANIMLI DEĞİL).
    for (const src of [ADRES, YORUM]) {
      expect(src).toContain('STOREFRONT_BRIDGE_KEY');
    }
  });
});
