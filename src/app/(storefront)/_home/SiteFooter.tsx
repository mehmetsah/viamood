import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export interface FooterCol { heading: string; links: { label: string; url: string }[] }
export interface FooterConfig {
  footer_text?: string | null;
  footerCols?: FooterCol[];
  footer_desc?: string;
  footer_phone?: string;
  footer_email?: string;
  footer_address?: string;
  footer_instagram?: string;
}

/** viamood.com.tr footer'ı birebir: marka + 4 link sütunu + ödeme ikonları + telif. */
export const DEFAULT_FOOTER_COLS: FooterCol[] = [
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

const DEF_DESC = 'Mutfak, banyo, dolap içi ve günlük yaşam alanlarınız için pratik düzenleyici ve saklama çözümleri. İstanbul / Beyoğlu’ndan tüm Türkiye’ye.';
const DEF_PHONE = '0553 170 71 32';
const DEF_EMAIL = 'viahomedecor25@gmail.com';
const DEF_ADDRESS = 'Bostan Mh. Kaşkaval Sk. No:23 Beyoğlu / İstanbul';
const DEF_IG = 'https://instagram.com/viamood.store';

export function SiteFooter({ config = {} }: { config?: FooterConfig }) {
  const cols = config.footerCols?.length ? config.footerCols : DEFAULT_FOOTER_COLS;
  const desc = config.footer_desc || DEF_DESC;
  const phone = config.footer_phone || DEF_PHONE;
  const email = config.footer_email || DEF_EMAIL;
  const address = config.footer_address || DEF_ADDRESS;
  const ig = config.footer_instagram || DEF_IG;
  const tel = '+' + phone.replace(/\D/g, '');

  return (
    <footer className="emp-ft2">
      <div className="emp-wrap emp-ft2__top">
        <div className="emp-ft2__brand">
          <Logo width={96} />
          <p className="emp-ft2__desc">{desc}</p>
          <ul className="emp-ft2__contact">
            <li>📞 <a href={`tel:${tel}`}>{phone}</a></li>
            <li>✉️ <a href={`mailto:${email}`}>{email}</a></li>
            <li>📍 {address}</li>
          </ul>
          <div className="emp-ft2__social">
            <a href={`https://wa.me/${tel.replace('+', '')}`} target="_blank" rel="noopener" aria-label="WhatsApp">WA</a>
            <a href={ig} target="_blank" rel="noopener" aria-label="Instagram">IG</a>
            <a href={`mailto:${email}`} aria-label="E-posta">@</a>
          </div>
        </div>

        {cols.map((col) => (
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
            {config.footer_text || '© 2026 Via Mood · Via Glocal Dış Tic. Ltd. Şti. · Vergi No 9250770472 · Tüm hakları saklıdır.'}
            <span className="emp-ft2__ops">
              <Link href="/auth/sign-in">Operatör Girişi</Link> · <Link href="/auth/sign-up">Tedarikçi Başvurusu</Link>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
