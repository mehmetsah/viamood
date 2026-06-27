'use client';
import { useState } from 'react';

/** Koyu newsletter bloğu. via-mood-home .emp-news */
export function Newsletter({ title, lead }: { title?: string; lead?: string }) {
  const [done, setDone] = useState(false);
  return (
    <section className="emp-news">
      <div className="emp-news__inner">
        <h2 className="emp-news__title">{title || 'Yeniliklerden ilk siz haberdar olun'}</h2>
        <p className="emp-news__lead">{lead || 'Mevsim koleksiyonları ve özel indirimler için kaydolun.'}</p>
        {done ? (
          <p style={{ color: '#f25334', fontWeight: 600 }}>Teşekkürler! Kaydınız alındı.</p>
        ) : (
          <form className="emp-news__form" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
            <input className="emp-news__input" type="email" required placeholder="E-posta adresiniz" />
            <button className="emp-news__btn" type="submit">Kaydol</button>
          </form>
        )}
      </div>
    </section>
  );
}
