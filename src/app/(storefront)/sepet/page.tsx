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

const tl = (c: number) => (c / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';

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
    if (data.ok) setCart(data.cart);
    setBusy(false);
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-neutral-400">Sepet yükleniyor…</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h1 className="text-2xl font-bold mb-2">Sepetin boş</h1>
        <p className="text-neutral-500 mb-6">Ürünlere göz at, beğendiklerini sepete ekle.</p>
        <Link href="/magaza" className="px-6 py-3 rounded-full bg-[var(--color-brand-ink)] text-white font-semibold">
          Ürünlere git
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Sepetim ({cart.item_count})</h1>

      <div className="bg-white rounded-2xl border divide-y">
        {cart.items.map((it) => (
          <div key={it.variant_id} className="flex items-center gap-4 p-4">
            <div className="flex-1">
              <div className="font-medium">{it.title}</div>
              {it.vendor && <div className="text-xs text-neutral-500">{it.vendor}</div>}
              <div className="text-sm text-neutral-500 mt-0.5">{tl(it.unit_price_cents)}</div>
            </div>
            <div className="flex items-center border rounded-lg">
              <button disabled={busy} onClick={() => change(it.variant_id, it.quantity - 1)} className="px-3 py-1.5 text-lg disabled:opacity-40">−</button>
              <span className="w-9 text-center">{it.quantity}</span>
              <button disabled={busy} onClick={() => change(it.variant_id, it.quantity + 1)} className="px-3 py-1.5 text-lg disabled:opacity-40">+</button>
            </div>
            <div className="w-24 text-right font-semibold">{tl(it.line_price_cents)}</div>
            <button disabled={busy} onClick={() => change(it.variant_id, 0)} className="text-neutral-400 hover:text-red-600 text-sm">✕</button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-neutral-500">Ara toplam</div>
        <div className="text-2xl font-bold">{tl(cart.items_subtotal_cents)}</div>
      </div>
      <p className="text-xs text-neutral-400 text-right mt-1">Kargo ödeme adımında hesaplanır.</p>

      <Link
        href="/odeme"
        className="mt-6 block text-center px-6 py-4 rounded-full bg-[var(--color-brand-orange)] text-white font-semibold hover:opacity-90"
      >
        Ödemeye Geç →
      </Link>
    </div>
  );
}
