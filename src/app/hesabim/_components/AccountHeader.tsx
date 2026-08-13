'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { signOutToStorefrontAction } from '@/lib/actions/auth';
import { Logo } from '@/components/ui/Logo';

interface Props {
  initials: string;
  name: string;
  memberSince?: string;
  counts: { siparis: number; iade: number; adres: number };
}

const NAV = [
  { href: '/hesabim', label: 'Siparişlerim', key: 'siparis' as const },
  { href: '/hesabim/iadeler', label: 'İadelerim', key: 'iade' as const },
  { href: '/hesabim/adresler', label: 'Adreslerim', key: 'adres' as const },
  { href: '/hesabim/profil', label: 'Profilim', key: null },
];

function aktifMi(pathname: string, href: string): boolean {
  if (href === '/hesabim') return pathname === '/hesabim';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AccountHeader({ initials, name, memberSince, counts }: Props) {
  const pathname = usePathname();
  const [menuAcik, setMenuAcik] = useState(false);
  const kisiRef = useRef<HTMLDivElement>(null);

  // dışarı tıkla kapat
  useEffect(() => {
    function dis(e: MouseEvent) {
      if (kisiRef.current && !kisiRef.current.contains(e.target as Node)) setMenuAcik(false);
    }
    document.addEventListener('click', dis);
    return () => document.removeEventListener('click', dis);
  }, []);

  function temaToggle() {
    const kok = document.documentElement;
    const koyu =
      kok.getAttribute('data-theme') === 'dark' ||
      (!kok.getAttribute('data-theme') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    const yeni = koyu ? 'light' : 'dark';
    kok.setAttribute('data-theme', yeni);
    try {
      localStorage.setItem('vm_tema', yeni);
    } catch {
      /* özel mod */
    }
  }

  return (
    <header className="vh-ust">
      <div className="vh-ust-ic">
        <a href="https://viamood.com.tr" className="vh-marka" aria-label="Via Mood — mağazaya dön">
          <Logo width={64} priority />
        </a>

        <nav className="vh-nav" aria-label="Hesap menüsü">
          {NAV.map((n) => {
            const aktif = aktifMi(pathname, n.href);
            const sayi = n.key ? counts[n.key] : 0;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={aktif ? 'acik' : undefined}
                aria-current={aktif ? 'page' : undefined}
              >
                {n.label}
                {n.key && sayi > 0 ? <span className="vh-sayac">{sayi}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="vh-ust-sag">
          <button className="vh-tema" onClick={temaToggle} aria-label="Açık / koyu tema">
            <svg
              className="vh-ay"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <svg
              className="vh-gunes"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          </button>

          <div className={menuAcik ? 'vh-kisi acik' : 'vh-kisi'} ref={kisiRef}>
            <button
              className="vh-kisi-cip"
              aria-haspopup="menu"
              aria-expanded={menuAcik}
              onClick={(e) => {
                e.stopPropagation();
                setMenuAcik((v) => !v);
              }}
            >
              <span className="vh-avatar">{initials}</span>
              <span className="ad">
                {name}
                {memberSince ? <span>Üyelik: {memberSince}</span> : null}
              </span>
              <svg
                className="kar"
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div className="vh-acilir" role="menu">
              <Link href="/hesabim/profil" role="menuitem">
                Profilim
              </Link>
              <Link href="/hesabim/adresler" role="menuitem">
                Adreslerim
              </Link>
              <form action={signOutToStorefrontAction}>
                <button type="submit" className="cikis" role="menuitem">
                  Çıkış yap
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
