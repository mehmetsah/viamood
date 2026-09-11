/**
 * Hoş geldin pop-up — form doğrulama testleri (Defter #974).
 * Saf mantık; DB'ye bağlanmaz.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({ welcomeSignups: {} }));
vi.mock('@/lib/email/sender', () => ({ sendEmail: vi.fn() }));
vi.mock('@/lib/email/templates', () => ({ welcomeDiscountEmail: vi.fn() }));

const { normalizeTrPhone, validateSignup, CONSENT_TEXT } = await import('@/lib/welcome-signup');

const gecerli = {
  name: 'Ayşe Yılmaz',
  email: 'ayse@example.com',
  phone: '0532 111 22 33',
  consent: true,
};

describe('TR telefon normalizasyonu', () => {
  it.each([
    ['0532 111 22 33', '+905321112233'],
    ['05321112233', '+905321112233'],
    ['5321112233', '+905321112233'],
    ['+90 532 111 22 33', '+905321112233'],
    ['905321112233', '+905321112233'],
    ['(0532) 111-22-33', '+905321112233'],
  ])('%s → %s', (girdi, beklenen) => {
    expect(normalizeTrPhone(girdi)).toBe(beklenen);
  });

  it.each([
    ['0212 111 22 33', 'sabit hat (5 ile başlamıyor)'],
    ['12345', 'çok kısa'],
    ['053211122', 'eksik hane'],
    ['05321112233444', 'fazla hane'],
    ['', 'boş'],
    ['abcdefghij', 'harf'],
  ])('%s reddedilir (%s)', (girdi) => {
    expect(normalizeTrPhone(girdi)).toBeNull();
  });
});

describe('form doğrulama', () => {
  it('geçerli form hatasız geçer', () => {
    expect(validateSignup(gecerli)).toEqual({});
  });

  it('onay kutusu işaretsizse REDDEDİLİR (sunucu tarafı zorlama)', () => {
    const h = validateSignup({ ...gecerli, consent: false });
    expect(h.consent).toBeTruthy();
  });

  it('onay alanı hiç gönderilmezse de reddedilir', () => {
    const h = validateSignup({ ...gecerli, consent: undefined as unknown as boolean });
    expect(h.consent).toBeTruthy();
  });

  it.each([
    'bozuk',
    'a@b',
    '@example.com',
    'ayse@',
    'ayse example.com',
  ])('geçersiz e-posta reddedilir: %s', (email) => {
    expect(validateSignup({ ...gecerli, email }).email).toBeTruthy();
  });

  it('tek kelimelik isim reddedilir (ad + soyad isteniyor)', () => {
    expect(validateSignup({ ...gecerli, name: 'Ayşe' }).name).toBeTruthy();
  });

  it('çok kısa isim reddedilir', () => {
    expect(validateSignup({ ...gecerli, name: 'A' }).name).toBeTruthy();
  });

  it('geçersiz telefon reddedilir', () => {
    expect(validateSignup({ ...gecerli, phone: '0212 111 22 33' }).phone).toBeTruthy();
  });

  it('birden fazla hata aynı anda döner', () => {
    const h = validateSignup({ name: '', email: 'x', phone: 'y', consent: false });
    expect(Object.keys(h).sort()).toEqual(['consent', 'email', 'name', 'phone']);
  });
});

describe('KVKK onay metni', () => {
  it('temadaki metinle birebir aynı olmalı', () => {
    // sections/via-hosgeldin-popup.liquid içindeki onay etiketiyle AYNI cümle.
    expect(CONSENT_TEXT).toBe(
      "Via Mood'dan kampanya ve fırsat iletileri almak istiyorum. " +
        'Kişisel verileriniz Aydınlatma Metni kapsamında işlenir.',
    );
  });
});
