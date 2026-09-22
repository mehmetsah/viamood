/**
 * ÇİVİ — hoş geldin indirim maili hangi kanalla gider? (22 Eyl 2026 arızası)
 *
 * ÖLÇÜLEN ARIZA: `deliverDiscountEmail` kanal koşulunu YALNIZ `RESEND_API_KEY`
 * üzerinden kuruyordu. Prod'da RESEND_API_KEY yok, SMTP_* var ve çalışıyor
 * (şifremi-unuttum o kanaldan gidiyor). Sonuç: 7 kaydın 7'si 'skipped',
 * müşteriye tek bir indirim kodu maili çıkmadı — üstelik API 200 dönüyordu.
 *
 * Bu dosya koşulun `mailKanaliHazir()`den okunduğunu çiviler. Koşul yeniden
 * RESEND'e bağlanırsa ilk test KIRILIR (negatif kanıt aşağıda ayrıca var).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.fn();
const mailKanaliHazir = vi.fn();
const guncellenen: Array<Record<string, unknown>> = [];

vi.mock('@/lib/email/sender', () => ({ sendEmail, mailKanaliHazir }));
vi.mock('@/lib/email/templates', () => ({
  welcomeDiscountEmail: () => ({ subject: 'konu', html: '<p>x</p>', text: 'x' }),
}));
vi.mock('@/db/schema', () => ({ welcomeSignups: { id: 'id' } }));
vi.mock('@/db/client', () => ({
  db: {
    update: () => ({
      set: (v: Record<string, unknown>) => {
        guncellenen.push(v);
        return { where: () => Promise.resolve() };
      },
    }),
  },
}));
vi.mock('drizzle-orm', () => ({ eq: () => ({}), and: () => ({}), gt: () => ({}), sql: () => ({}) }));

const { deliverDiscountEmail } = await import('@/lib/welcome-signup');

beforeEach(() => {
  sendEmail.mockReset().mockResolvedValue({ ok: true, id: 'msg-1', kanal: 'smtp' });
  mailKanaliHazir.mockReset();
  guncellenen.length = 0;
  process.env.WELCOME_DISCOUNT_CODE = 'XX10VIA';
});

describe('kanal koşulu sender.ts ile aynı yerden okunur', () => {
  it('RESEND YOK ama SMTP VAR → mail GÖNDERİLİR (arızanın tam hâli)', async () => {
    delete process.env.RESEND_API_KEY; // prod'un bugünkü hâli
    mailKanaliHazir.mockReturnValue(true); // SMTP açık
    await deliverDiscountEmail('id-1', 'musteri@example.com', 'Ayşe Yılmaz');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(guncellenen.at(-1)?.emailStatus).toBe('sent');
  });

  it('hiçbir kanal yoksa gönderilmez ve sebep yazılır', async () => {
    mailKanaliHazir.mockReturnValue(false);
    await deliverDiscountEmail('id-2', 'musteri@example.com', 'Ayşe Yılmaz');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(guncellenen.at(-1)?.emailStatus).toBe('skipped');
    expect(String(guncellenen.at(-1)?.emailError)).toContain('SMTP_USER');
  });

  it('indirim kodu yoksa kanal açık olsa da gönderilmez', async () => {
    delete process.env.WELCOME_DISCOUNT_CODE;
    mailKanaliHazir.mockReturnValue(true);
    await deliverDiscountEmail('id-3', 'musteri@example.com', 'Ayşe Yılmaz');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(guncellenen.at(-1)?.emailError).toBe('WELCOME_DISCOUNT_CODE tanımsız');
  });

  it('gönderim başarısızsa failed damgalanır (sessiz başarı yok)', async () => {
    mailKanaliHazir.mockReturnValue(true);
    sendEmail.mockResolvedValue({ ok: false, error: 'SMTP reddetti', kanal: 'smtp' });
    await deliverDiscountEmail('id-4', 'musteri@example.com', 'Ayşe Yılmaz');
    expect(guncellenen.at(-1)?.emailStatus).toBe('failed');
  });
});
