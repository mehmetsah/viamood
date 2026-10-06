/**
 * ÇİVİ — #990686 madde 3: "ilk açılan formda mail gönderimi" iki EKSİK ayağı.
 *
 * Mail akışı ZATEN kuruluydu ve kardeş çiviler (welcome-signup · welcome-mail-kanal)
 * doğrulamayı ve kanal seçimini koruyordu. Ölçtüm, iki ayak açıktaydı:
 *
 *   (b) Zorunlu alan eksikken mail gönderme çağrısının YAPILMADIĞI hiçbir yerde
 *       iddia edilmiyordu. `welcome-signup.test.ts` `sendEmail`i mock'luyor ama
 *       yalnız `validateSignup`i çağırıyor — yani çağrılmadığını ÖLÇMÜYOR.
 *       Yarın doğrulama ile gönderim sırası ters çevrilse (önce gönder, sonra
 *       doğrula) hiçbir test kırılmazdı: geçersiz forma mail gider, indirim kodu
 *       bot'a sızar.
 *
 *   (4) Mail GÖNDERİLEMEZSE formun yine de BAŞARI döndüğü ölçülmüyordu.
 *       `welcome-mail-kanal` yalnız `deliverDiscountEmail`i izole ölçüyor;
 *       `createSignup` dönüşüne bakmıyor. Gönderim `await` edilir hâle gelirse
 *       SMTP'nin bir saniyelik arızası kullanıcıya "form gönderilemedi" diye
 *       yansırdı — kayıt yazılmış olmasına rağmen.
 *
 * 🔴 GERÇEK MAİL GÖNDERİLMEZ: gönderim katmanı tamamen taklit (mock).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.fn();
const mailKanaliHazir = vi.fn();
const yazilanKayitlar: Array<Record<string, unknown>> = [];

vi.mock('@/lib/email/sender', () => ({ sendEmail, mailKanaliHazir }));
vi.mock('@/lib/email/templates', () => ({
  welcomeDiscountEmail: () => ({ subject: 'konu', html: '<p>x</p>', text: 'x' }),
}));
vi.mock('@/db/schema', () => ({ welcomeSignups: { id: 'id' } }));
vi.mock('@/db/client', () => ({
  db: {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        yazilanKayitlar.push(v);
        return { returning: () => Promise.resolve([{ id: 'kayit-1' }]) };
      },
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    // ipCount() bu yoldan okuyor; hız sınırı testin konusu değil, 0 döndürülüyor.
    select: () => ({ from: () => ({ where: () => Promise.resolve([{ n: 0 }]) }) }),
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: () => ({}), and: () => ({}), gt: () => ({}), sql: () => ({}), count: () => ({}),
}));

const { createSignup } = await import('@/lib/welcome-signup');

const GECERLI = {
  name: 'Ayşe Yılmaz',
  email: 'ayse@example.com',
  phone: '0532 111 22 33',
  consent: true,
};

beforeEach(() => {
  sendEmail.mockReset().mockResolvedValue({ ok: true, id: 'msg-1', kanal: 'smtp' });
  mailKanaliHazir.mockReset().mockReturnValue(true);
  yazilanKayitlar.length = 0;
  process.env.WELCOME_DISCOUNT_CODE = 'XX10VIA';
});

describe('(a) POZİTİF — geçerli form mail gönderme çağrısını TETİKLER', () => {
  it('geçerli veri → kayıt yazılır ve gönderim çağrılır', async () => {
    const res = await createSignup({ ...GECERLI });
    expect(res.ok, 'geçerli form reddedildi').toBe(true);
    expect(yazilanKayitlar.length, 'kayıt yazılmadı').toBe(1);
    // Gönderim ateşle-unut (`void`) olduğu için mikro-görev sırası beklenir.
    await new Promise((r) => setTimeout(r, 0));
    expect(sendEmail, 'geçerli formda mail çağrısı yapılmadı').toHaveBeenCalled();
  });
});

describe('(b) NEGATİF — zorunlu alan eksikse gönderim YAPILMAZ', () => {
  it('onay kutusu yoksa: hata döner, kayıt YAZILMAZ, mail ÇAĞRILMAZ', async () => {
    const res = await createSignup({ ...GECERLI, consent: false });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status, 'doğrulama hatası 400 olmalı').toBe(400);
    expect(res.fieldErrors?.consent, 'kullanıcıya alan hatası dönmüyor').toBeTruthy();
    expect(yazilanKayitlar.length, 'geçersiz formda kayıt yazıldı').toBe(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(sendEmail, '🔴 geçersiz forma mail gitti — indirim kodu sızar').not.toHaveBeenCalled();
  });

  it('e-posta geçersizse de mail ÇAĞRILMAZ', async () => {
    const res = await createSignup({ ...GECERLI, email: 'bu-eposta-degil' });
    expect(res.ok).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('telefon geçersizse de mail ÇAĞRILMAZ', async () => {
    const res = await createSignup({ ...GECERLI, phone: '123' });
    expect(res.ok).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('(4) DAYANIKLILIK — mail düşse de form ÇÖKMEZ', () => {
  it('sendEmail HATA FIRLATIRSA form yine BAŞARI döner', async () => {
    sendEmail.mockRejectedValue(new Error('SMTP bağlantı reddedildi'));
    const res = await createSignup({ ...GECERLI });
    expect(res.ok, '🔴 mail arızası kullanıcıya form hatası olarak yansıdı').toBe(true);
    expect(yazilanKayitlar.length, 'mail düşünce kayıt da kaybolmuş').toBe(1);
  });

  it('kanal kapalıyken de form BAŞARI döner (kayıt tutulur)', async () => {
    mailKanaliHazir.mockReturnValue(false);
    const res = await createSignup({ ...GECERLI });
    expect(res.ok).toBe(true);
    expect(yazilanKayitlar.length).toBe(1);
  });

  it('DEĞİŞMEZ: gönderim ateşle-unut — createSignup onu AWAIT ETMEZ', () => {
    // Kaynak metni kilidi: `await deliverDiscountEmail` yazılırsa SMTP'nin
    // yavaşlığı doğrudan kullanıcının bekleme süresine binerdi.
    const { readFileSync } = require('node:fs');
    const kaynak = readFileSync('src/lib/welcome-signup.ts', 'utf8');
    expect(kaynak, 'gönderim await edilmiş — form SMTP hızına bağlandı').toMatch(
      /void deliverDiscountEmail\(/,
    );
    expect(kaynak).not.toMatch(/await deliverDiscountEmail\(/);
  });
});
