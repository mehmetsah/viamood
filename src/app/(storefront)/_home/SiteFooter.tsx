import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

/** viamood.com.tr footer'ı birebir: marka + 4 link sütunu + ödeme ikonları + telif. */
const COLS = [
  {
    heading: 'Kategoriler',
    links: [
      { label: 'Saklama Kabı', url: '/magaza' },
      { label: 'Dolap İçi Düzenleyici', url: '/magaza' },
      { label: 'Banyo Düzenleyici', url: '/magaza' },
      { label: 'Çamaşır Sepeti', url: '/magaza' },
      { label: 'Temizlik Gereçleri', url: '/magaza' },
      { label: 'Tüm Kategoriler', url: '/magaza' },
    ],
  },
  {
    heading: 'Kurumsal',
    links: [
      { label: 'Hakkımızda', url: '/sayfa/hakkimizda' },
      { label: 'İletişim', url: '/sayfa/iletisim' },
      { label: 'Hesabım', url: '/hesabim' },
    ],
  },
  {
    heading: 'Yardım',
    links: [
      { label: 'İade ve Teslimat', url: '/sayfa/iade-ve-teslimat' },
      { label: 'Mesafeli Satış Sözleşmesi', url: '/sayfa/mesafeli-satis-sozlesmesi' },
      { label: 'Gizlilik Politikası', url: '/sayfa/gizlilik-politikasi' },
      { label: 'KVKK Aydınlatma Metni', url: '/sayfa/kvkk' },
    ],
  },
];

const PAYMENTS = ['VISA', 'MasterCard', 'Troy', 'PayTR', 'Kapıda Ödeme', 'Havale/EFT'];

export function SiteFooter({ footerText }: { footerText?: string | null }) {
  return (
    <footer className="emp-ft2">
      <div className="emp-wrap emp-ft2__top">
        <div className="emp-ft2__brand">
          <Logo width={96} />
          <p className="emp-ft2__desc">Mutfak, banyo, dolap içi ve günlük yaşam alanlarınız için pratik düzenleyici ve saklama çözümleri. İstanbul / Beyoğlu&apos;ndan tüm Türkiye&apos;ye.</p>
          <ul className="emp-ft2__contact">
            <li>📞 <a href="tel:+905531707132">0553 170 71 32</a></li>
            <li>✉️ <a href="mailto:viahomedecor25@gmail.com">viahomedecor25@gmail.com</a></li>
            <li>📍 Bostan Mh. Kaşkaval Sk. No:23 Beyoğlu / İstanbul</li>
          </ul>
          <div className="emp-ft2__social">
            <a href="https://wa.me/905531707132" target="_blank" rel="noopener" aria-label="WhatsApp">WA</a>
            <a href="https://instagram.com/viamood.store" target="_blank" rel="noopener" aria-label="Instagram">IG</a>
            <a href="mailto:viahomedecor25@gmail.com" aria-label="E-posta">@</a>
          </div>
        </div>

        {COLS.map((col) => (
          <div key={col.heading} className="emp-ft2__col">
            <p className="emp-ft2__h">{col.heading}</p>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.url.startsWith('/') ? <Link href={l.url}>{l.label}</Link> : <a href={l.url}>{l.label}</a>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="emp-ft2__bottom">
        <div className="emp-wrap emp-ft2__bottomrow">
          <div className="emp-ft2__pay">
            {PAYMENTS.map((p) => <span key={p}>{p}</span>)}
          </div>
          <p className="emp-ft2__copy">
            {footerText || '© 2026 Via Mood · Via Glocal Dış Tic. Ltd. Şti. · Vergi No 9250770472 · Tüm hakları saklıdır.'}
            <span className="emp-ft2__ops">
              <Link href="/auth/sign-in">Operatör Girişi</Link> · <Link href="/auth/sign-up">Tedarikçi Başvurusu</Link>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
