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
  compareAtCents?: number | null;
}
interface Opt {
  name: string;
  values: string[];
}

const money = (c: number) => (c / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

export function AddToCart({ variants, options, sku }: { variants: V[]; options: Opt[]; sku?: string | null }) {
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

  const priceCents = variant ? variant.priceCents : 0;
  const cmp = variant?.compareAtCents && variant.compareAtCents > priceCents ? variant.compareAtCents : null;

  const pick = (i: number, value: string) => setSelected((prev) => prev.map((s, idx) => (idx === i ? value : s)));

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
        window.dispatchEvent(new Event('vm-cart-updated'));
        setStatus('added');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <div>
      <div className="emp-pdp__price">
        {cmp ? <s className="emp-was" style={{ fontSize: 18 }}>{money(cmp)}</s> : null}
        <b>{money(priceCents)}</b>
      </div>
      {sku ? <p className="emp-pdp__sku">SKU: {sku}</p> : null}

      {options.map((opt, i) => (
        <div key={opt.name} className="emp-pdp__opt">
          <p className="emp-pdp__opt-label">{opt.name}</p>
          <div className="emp-pdp__chips">
            {opt.values.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => pick(i, val)}
                className={`emp-chip${selected[i] === val ? ' emp-chip--on' : ''}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="emp-qtyrow">
        <div className="emp-qty">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span>{qty}</span>
          <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!variant || status === 'loading'}
          className="emp-btn emp-btn--dark"
          style={{ flex: 1 }}
        >
          {status === 'loading' ? 'Ekleniyor…' : !variant ? 'Seçim yapın' : 'Sepete Ekle'}
        </button>
      </div>

      {status === 'added' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#ecfdf3', border: '1px solid #abefc6', borderRadius: 4, padding: '12px 16px', fontSize: 14, color: '#067647' }}>
          ✓ Sepete eklendi
          <Link href="/sepet" style={{ fontWeight: 600, textDecoration: 'underline', color: '#067647' }}>Sepete git →</Link>
        </div>
      )}
      {status === 'error' && (
        <div style={{ background: '#fef3f2', border: '1px solid #fecdca', borderRadius: 4, padding: '12px 16px', fontSize: 14, color: '#b42318' }}>
          Bir hata oldu, tekrar deneyin.
        </div>
      )}
    </div>
  );
}
