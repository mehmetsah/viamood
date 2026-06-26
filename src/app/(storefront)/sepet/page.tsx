'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Line {
  variant_id: string;
  quantity: number;
  title: string;
  vendor: string | null;
  unit_price_cents: number;
  line_price_cents: number;
}
interface CartView {
  token: string;
  item_count: number;
  items: Line[];
  items_subtotal_cents: number;
}

const tl = (c: number) => (c / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

export default function CartPage() {
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vm_cart_token') : null;
    if (!token) {
      setCart({ token: '', item_count: 0, items: [], items_subtotal_cents: 0 });
      setLoading(false);
      return;
    }
    const res = await fetch(`/api/v1/cart?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (data.ok) setCart(data.cart);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(variantId: string, quantity: number) {
    if (!cart?.token) return;
    setBusy(true);
    const res = await fetch('/api/v1/cart/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cart.token, variant_id: variantId, quantity }),
    });
    const data = await res.json();
    if (data.ok) {
      setCart(data.cart);
      window.dispatchEvent(new Event('vm-cart-updated'));
    }
    setBusy(false);
  }

  if (loading) {
    return <div className="emp"><div className="emp-wrap" style={{ padding: '80px 0', textAlign: 'center', color: '#bbb' }}>Sepet yükleniyor…</div></div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="emp">
        <div className="emp-wrap emp-empty">
          <div className="emp-empty__i">🛒</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Sepetin boş</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Ürünlere göz at, beğendiklerini sepete ekle.</p>
          <Link href="/magaza" className="emp-btn emp-btn--dark">Ürünlere git</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="emp">
      <section className="emp-cart">
        <div className="emp-wrap">
          <h1>Sepetim ({cart.item_count})</h1>
          <div className="emp-cart__grid">
            <div className="emp-cart__items">
              {cart.items.map((it) => (
                <div key={it.variant_id} className="emp-cart__row">
                  <div className="emp-cart__info">
                    {it.vendor && <p className="emp-cart__vendor">{it.vendor}</p>}
                    <p className="emp-cart__title">{it.title}</p>
                    <span className="emp-cart__unit">{tl(it.unit_price_cents)}</span>
                  </div>
                  <div className="emp-qty">
                    <button disabled={busy} onClick={() => change(it.variant_id, it.quantity - 1)}>−</button>
                    <span>{it.quantity}</span>
                    <button disabled={busy} onClick={() => change(it.variant_id, it.quantity + 1)}>+</button>
                  </div>
                  <div className="emp-cart__line">{tl(it.line_price_cents)}</div>
                  <button disabled={busy} onClick={() => change(it.variant_id, 0)} className="emp-cart__rm" aria-label="Kaldır">✕</button>
                </div>
              ))}
            </div>

            <div className="emp-cart__summary">
              <div className="emp-cart__sumrow"><span>Ara toplam</span><span>{tl(cart.items_subtotal_cents)}</span></div>
              <div className="emp-cart__sumtotal"><span>Toplam</span><span>{tl(cart.items_subtotal_cents)}</span></div>
              <p className="emp-cart__note">Kargo ödeme adımında hesaplanır.</p>
              <Link href="/odeme" className="emp-btn emp-btn--orange emp-btn--block">Ödemeye Geç →</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
