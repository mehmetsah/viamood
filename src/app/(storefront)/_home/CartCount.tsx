'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/** Header sepet ikonu + canlı adet rozeti ('vm-cart-updated' event'iyle güncellenir). */
export function CartCount() {
  const [n, setN] = useState(0);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('vm_cart_token');
      if (!token) {
        setN(0);
        return;
      }
      try {
        const r = await fetch(`/api/v1/cart?token=${encodeURIComponent(token)}`);
        const d = await r.json();
        if (d.ok) setN(d.cart.item_count || 0);
      } catch {
        /* yoksay */
      }
    };
    void load();
    const h = () => void load();
    window.addEventListener('vm-cart-updated', h);
    return () => window.removeEventListener('vm-cart-updated', h);
  }, []);

  return (
    <Link href="/sepet" className="emp-hd__icon emp-hd__cart" aria-label="Sepet">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6L5 3H2" /><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
      </svg>
      Sepet
      {n > 0 && <span className="emp-hd__count">{n}</span>}
    </Link>
  );
}
