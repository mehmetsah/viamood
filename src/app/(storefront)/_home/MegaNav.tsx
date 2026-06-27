'use client';
import Link from 'next/link';
import { useState } from 'react';
import { NAV_ITEMS, type NavItem } from './assets';

function Icon({ d }: { d: string }) {
  // eslint-disable-next-line react/no-danger
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" dangerouslySetInnerHTML={{ __html: d }} />;
}

/** viamood.com.tr mega-menü birebir: desktop hover dropdown (full-width, sütunlar) + mobil drawer (accordion).
 *  items verilmezse NAV_ITEMS (varsayılan birebir) kullanılır — /admin/theme menü editöründen düzenlenebilir. */
export function MegaNav({ items }: { items?: NavItem[] }) {
  const NAV = items?.length ? items : NAV_ITEMS;
  const [drawer, setDrawer] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <>
      <button className="emp-burger" aria-label="Menü" onClick={() => setDrawer(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>

      <nav className="emp-mm">
        {NAV.map((item) => (
          <div key={item.label} className={`emp-mm__item${item.mega?.length ? ' has-mega' : ''}`}>
            <Link href={item.url} className="emp-mm__link">
              <Icon d={item.icon} />
              <span>{item.label}</span>
            </Link>
            {item.mega?.length ? (
              <div className="emp-mm__panel">
                <div className="emp-mm__inner">
                  {item.mega.map((col) => (
                    <div key={col.heading} className="emp-mm__col">
                      <p className="emp-mm__coltitle">{col.heading}</p>
                      {col.links.map((l) => (
                        <Link key={l.label} href={l.url} className="emp-mm__collink">
                          <span className="emp-mm__chev">›</span>
                          <span className="emp-mm__lbl">{l.label}</span>
                          <span className="emp-mm__arrow">›</span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </nav>

      {drawer && (
        <div className="emp-drawer" onClick={() => setDrawer(false)}>
          <div className="emp-drawer__panel" onClick={(e) => e.stopPropagation()}>
            <div className="emp-drawer__head">
              <span>Menü</span>
              <button onClick={() => setDrawer(false)} aria-label="Kapat">✕</button>
            </div>
            <nav className="emp-drawer__nav">
              {NAV_ITEMS.map((item, i) => (
                <div key={item.label} className="emp-drawer__item">
                  {item.mega?.length ? (
                    <>
                      <button className="emp-drawer__row" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                        <span>{item.label}</span>
                        <span className={`emp-drawer__caret${openIdx === i ? ' on' : ''}`}>›</span>
                      </button>
                      {openIdx === i && (
                        <div className="emp-drawer__sub">
                          {item.mega.map((col) => (
                            <div key={col.heading}>
                              <p className="emp-drawer__subtitle">{col.heading}</p>
                              {col.links.map((l) => (
                                <Link key={l.label} href={l.url} className="emp-drawer__sublink" onClick={() => setDrawer(false)}>{l.label}</Link>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link href={item.url} className="emp-drawer__row" onClick={() => setDrawer(false)}>
                      <span>{item.label}</span>
                    </Link>
                  )}
                </div>
              ))}
            </nav>
            <div className="emp-drawer__foot">
              <Link href="/hesabim" onClick={() => setDrawer(false)}>Hesabım</Link>
              <Link href="/sepet" onClick={() => setDrawer(false)}>Sepet</Link>
              <Link href="/auth/sign-in" onClick={() => setDrawer(false)}>Giriş</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
