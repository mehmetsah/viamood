'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

interface V {
  vid: string;
  title: string | null;
  o1: string | null;
  o2: string | null;
  o3: string | null;
  priceCents: number;
}
interface Opt {
  name: string;
  values: string[];
}

export function AddToCart({ variants, options }: { variants: V[]; options: Opt[] }) {
  const [selected, setSelected] = useState<string[]>(() => options.map((o) => o.values[0] ?? ''));
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'added' | 'error'>('idle');

  const variant = useMemo(() => {
    if (!options.length) return variants[0];
    return variants.find((v) => {
      const vo = [v.o1, v.o2, v.o3];
      return options.every((_, i) => vo[i] === selected[i]);
    });
  }, [variants, options, selected]);

  const price = variant ? variant.priceCents / 100 : 0;

  const pick = (i: number, value: string) =>
    setSelected((prev) => prev.map((s, idx) => (idx === i ? value : s)));

  async function add() {
    if (!variant) return;
    setStatus('loading');
    try {
      const token = localStorage.getItem('vm_cart_token') || undefined;
      const res = await fetch('/api/v1/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, variant_id: variant.vid, quantity: qty }),
      });
      const data = (await res.json()) as { ok?: boolean; cart?: { token?: string } };
      if (data.ok && data.cart?.token) {
        localStorage.setItem('vm_cart_token', data.cart.token);
        setStatus('added');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="mt-4">
      <div className="text-3xl font-bold text-[var(--color-brand-orange)]">
        {price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
      </div>

      {/* Seçenekler */}
      {options.map((opt, i) => (
        <div key={opt.name} className="mt-5">
          <div className="text-sm font-medium mb-2">{opt.name}</div>
          <div className="flex flex-wrap gap-2">
            {opt.values.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => pick(i, val)}
                className={`px-4 py-2 rounded-lg border text-sm ${
                  selected[i] === val
                    ? 'border-[var(--color-brand-orange)] bg-[var(--color-brand-orange)]/10 font-medium'
                    : 'border-neutral-300 hover:border-neutral-400'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Adet + ekle */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex items-center border rounded-lg">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 text-lg">−</button>
          <span className="w-10 text-center">{qty}</span>
          <button type="button" onClick={() => setQty((q) => q + 1)} className="px-3 py-2 text-lg">+</button>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!variant || status === 'loading'}
          className="flex-1 px-6 py-3 rounded-full bg-[var(--color-brand-ink)] text-white font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {status === 'loading' ? 'Ekleniyor…' : !variant ? 'Seçim yapın' : 'Sepete Ekle'}
        </button>
      </div>

      {status === 'added' && (
        <div className="mt-3 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✓ Sepete eklendi
          <Link href="/sepet" className="font-semibold underline">Sepete git →</Link>
        </div>
      )}
      {status === 'error' && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          Bir hata oldu, tekrar deneyin.
        </div>
      )}
    </div>
  );
}
