/**
 * Şifremi Unuttum — EKRAN METNİ testi (Defter #1448).
 *
 * Sunucu tarafı `tests/sifremi-unuttum-kanal-kapali.test.ts`te çivilendi; burada
 * ölçülen şey müşterinin GERÇEKTEN NE GÖRDÜĞÜ: sayfa bileşeni HTML'e basılıp
 * metin aranıyor. Arızanın yaşadığı yer tam olarak burasıydı — sunucu doğru
 * bilgiyi (`kanalKapali`) veriyor olsa bile bileşen ona bakmazsa müşteri yine
 * yeşil "gönderdik" onayını görürdü.
 *
 * useActionState taklit ediliyor: form GÖNDERİLDİKTEN SONRAKİ durum doğrudan
 * besleniyor, böylece React olay döngüsü olmadan üç hâl de basılabiliyor.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type Durum = { success: boolean; data?: unknown; error?: string; fieldErrors?: Record<string, string> } | null;

let durum: Durum = null;

vi.mock('react', async () => {
  const gercek = await vi.importActual<typeof import('react')>('react');
  return { ...gercek, useActionState: () => [durum, () => {}, false] };
});

vi.mock('@/lib/actions/auth', () => ({ requestPasswordResetAction: vi.fn() }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const { default: SifremiUnuttumPage } = await import('@/app/auth/sifremi-unuttum/page');

function ciz(d: Durum): string {
  durum = d;
  return renderToStaticMarkup(<SifremiUnuttumPage />).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

const KANAL_KAPALI_MESAJ =
  'Şu an şifre sıfırlama e-postası gönderemiyoruz — e-posta servisimizde geçici bir ' +
  'aksaklık var. Lütfen birazdan tekrar dene; sürerse destek@viamood.com adresine yazabilirsin.';

describe('ekranda ne yazıyor', () => {
  it('KANAL KAPALI → dürüst uyarı basılır, "gönderdik" onayı BASILMAZ', () => {
    const html = ciz({ success: true, data: { kanalKapali: true, message: KANAL_KAPALI_MESAJ } });
    expect(html).toContain('gönderemiyoruz');
    expect(html).toContain('destek@viamood.com');
    // ARIZANIN TA KENDİSİ — bu iki ifade ekrana ARTIK çıkmamalı:
    expect(html).not.toContain('bağlantısını gönderdik');
    expect(html).not.toContain('Gelen kutunu');
  });

  it('KANAL KAPALI → form AÇIK kalır, kullanıcı beklemeden tekrar deneyebilir', () => {
    const html = ciz({ success: true, data: { kanalKapali: true, message: KANAL_KAPALI_MESAJ } });
    expect(html).toContain('Sıfırlama bağlantısı gönder'); // gönder düğmesi ekranda
  });

  it('KANAL AÇIK → eski yeşil onay ekranı aynen korunur (regresyon yok)', () => {
    const html = ciz({
      success: true,
      data: {
        message:
          'E-posta adresin kayıtlıysa şifre sıfırlama bağlantısını gönderdik. ' +
          'Gelen kutunu (ve spam klasörünü) kontrol et.',
      },
    });
    expect(html).toContain('bağlantısını gönderdik');
    expect(html).toContain('Gelen kutunu');
    expect(html).not.toContain('Sıfırlama bağlantısı gönder'); // form kapandı, onay ekranı var
  });

  it('ORAN SINIRI → mevcut kırmızı hata kutusu bozulmadan çalışır', () => {
    const html = ciz({ success: false, error: 'Az önce bir bağlantı gönderdik. Lütfen 5 dakika sonra tekrar dene.' });
    expect(html).toContain('5 dakika sonra tekrar dene');
    expect(html).toContain('Sıfırlama bağlantısı gönder');
  });

  it('İLK AÇILIŞ → ne uyarı ne onay, yalnız form', () => {
    const html = ciz(null);
    expect(html).toContain('Sıfırlama bağlantısı gönder');
    expect(html).not.toContain('gönderemiyoruz');
    expect(html).not.toContain('bağlantısını gönderdik');
  });
});
