'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ILLER, getIlceler } from '@/lib/tr-addresses';
import type { PaymentSettings } from '@/db/schema';

interface CartView {
  token: string;
  item_count: number;
  items: { variant_id: string; quantity: number; title: string; line_price_cents: number }[];
  items_subtotal_cents: number;
}

const tl = (c: number) => (c / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
const inputCls =
  'h-11 w-full px-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-[var(--color-brand-orange)]';

type Method = 'havale' | 'cod';

export function CheckoutForm({ payment }: { payment: PaymentSettings }) {
  const [cart, setCart] = useState<CartView | null>(null);
  const [f, setF] = useState({
    first_name: '', last_name: '', phone: '', email: '', address1: '', postal_code: '',
  });
  const [il, setIl] = useState('');
  const [ilce, setIlce] = useState('');
  const [mahalle, setMahalle] = useState('');
  const [mahalleler, setMahalleler] = useState<string[]>([]);
  const [shippingCents, setShippingCents] = useState<number | null>(null);
  const [method, setMethod] = useState<Method | ''>('');
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle');
  const [result, setResult] = useState<{ ok: boolean; orderCode?: string; error?: string } | null>(null);

  const ilceler = useMemo(() => (il ? getIlceler(il) : []), [il]);

  // Sepet yükle
  useEffect(() => {
    const token = localStorage.getItem('vm_cart_token');
    if (!token) return setCart({ token: '', item_count: 0, items: [], items_subtotal_cents: 0 });
    fetch(`/api/v1/cart?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => d.ok && setCart(d.cart));
  }, []);

  // Mahalle + kargo (il+ilçe seçilince)
  useEffect(() => {
    if (!il || !ilce) return;
    fetch(`/api/v1/tr/mahalle?il=${encodeURIComponent(il)}&ilce=${encodeURIComponent(ilce)}`)
      .then((r) => r.json())
      .then((d) => setMahalleler(Array.isArray(d.mahalleler) ? d.mahalleler : Array.isArray(d) ? d : []))
      .catch(() => setMahalleler([]));
    const count = cart?.item_count || 1;
    fetch('/api/v1/shipping/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ province: il, district: ilce, item_count: count }),
    })
      .then((r) => r.json())
      .then((d) => setShippingCents(d.ok && typeof d.shipping_tl === 'number' ? Math.round(d.shipping_tl * 100) : null))
      .catch(() => setShippingCents(null));
  }, [il, ilce, cart?.item_count]);

  const subtotal = cart?.items_subtotal_cents ?? 0;
  const ship = shippingCents ?? 0;
  const freeShip = false; // ayar eşiği ileride
  const total = subtotal + (freeShip ? 0 : ship);

  const valid = f.first_name && f.last_name && f.phone && f.email.includes('@') && f.address1 && il && ilce && method;

  const submit = useCallback(async () => {
    if (!cart?.token || !valid || !method) return;
    setStatus('submitting');
    setResult(null);
    try {
      // 1) Adres + kargo + ödeme yöntemini sepete yaz
      await fetch('/api/v1/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cart.token,
          attributes: {
            first_name: f.first_name, last_name: f.last_name, phone: f.phone, email: f.email,
            address1: f.address1, postal_code: f.postal_code,
            il, ilce, mahalle,
            shipping_cost: String(ship / 100),
            payment_method: method,
          },
        }),
      });
      // 2) Siparişe dönüştür (havale/COD → native sipariş)
      const res = await fetch('/api/v1/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cart.token, payment_method: method }),
      });
      const d = await res.json();
      if (d.ok) {
        localStorage.removeItem('vm_cart_token');
        setResult({ ok: true, orderCode: d.order_code });
      } else {
        setResult({ ok: false, error: d.error || 'Sipariş oluşturulamadı' });
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Hata' });
    } finally {
      setStatus('idle');
    }
  }, [cart, valid, method, f, il, ilce, mahalle, ship]);

  if (result?.ok) {
    return (
      <div className="bg-white rounded-2xl border p-10 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">Siparişin alındı!</h2>
        <p className="text-neutral-600">
          Sipariş numaran: <strong>{result.orderCode}</strong>
        </p>
        <p className="text-sm text-neutral-500 mt-2">
          {method === 'havale' ? 'Havale bilgileri e-postana gönderildi.' : 'Kapıda ödeme ile teslim edilecek.'}
        </p>
        <Link href="/magaza" className="inline-block mt-6 px-6 py-3 rounded-full bg-[var(--color-brand-ink)] text-white font-semibold">
          Alışverişe devam et
        </Link>
      </div>
    );
  }

  if (cart && cart.items.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-500">
        Sepetin boş. <Link href="/magaza" className="text-[var(--color-brand-orange)] underline">Ürünlere git</Link>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-8 items-start">
      {/* Sol: adres + ödeme */}
      <div className="flex flex-col gap-6">
        <section className="bg-white rounded-2xl border p-6">
          <h2 className="font-bold border-b pb-2 mb-4">Teslimat adresi</h2>
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} placeholder="Ad" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
            <input className={inputCls} placeholder="Soyad" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
            <input className={inputCls} placeholder="Telefon" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <input className={inputCls} placeholder="E-posta" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <select className={inputCls} value={il} onChange={(e) => { setIl(e.target.value); setIlce(''); setMahalle(''); }}>
              <option value="">İl seç</option>
              {ILLER.map((p) => <option key={p.kod} value={p.ad}>{p.ad}</option>)}
            </select>
            <select className={inputCls} value={ilce} onChange={(e) => { setIlce(e.target.value); setMahalle(''); }} disabled={!il}>
              <option value="">İlçe seç</option>
              {ilceler.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className={inputCls} value={mahalle} onChange={(e) => setMahalle(e.target.value)} disabled={!mahalleler.length}>
              <option value="">Mahalle</option>
              {mahalleler.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <textarea className={`${inputCls} h-auto py-2 mt-3`} rows={2} placeholder="Açık adres (cadde, sokak, no, daire)" value={f.address1} onChange={(e) => setF({ ...f, address1: e.target.value })} />
          <input className={`${inputCls} mt-3`} placeholder="Posta kodu (opsiyonel)" value={f.postal_code} onChange={(e) => setF({ ...f, postal_code: e.target.value })} />
        </section>

        <section className="bg-white rounded-2xl border p-6">
          <h2 className="font-bold border-b pb-2 mb-4">Ödeme yöntemi</h2>
          <div className="flex flex-col gap-2">
            {payment.havale_enabled && (
              <label className="flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer">
                <input type="radio" name="m" checked={method === 'havale'} onChange={() => setMethod('havale')} />
                <span className="font-medium text-sm">Havale / EFT</span>
              </label>
            )}
            {payment.cod_enabled && (
              <label className="flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer">
                <input type="radio" name="m" checked={method === 'cod'} onChange={() => setMethod('cod')} />
                <span className="font-medium text-sm">Kapıda ödeme</span>
              </label>
            )}
            {(payment.iyzico_enabled || payment.paytr_enabled) && (
              <div className="border rounded-lg px-4 py-3 text-sm text-neutral-400">
                💳 Kredi/banka kartı — yakında (sandbox doğrulaması sonrası)
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Sağ: özet */}
      <aside className="bg-white rounded-2xl border p-6 sticky top-20">
        <h2 className="font-bold border-b pb-2 mb-3">Özet</h2>
        <div className="flex flex-col gap-2 text-sm">
          {cart?.items.map((it) => (
            <div key={it.variant_id} className="flex justify-between">
              <span className="text-neutral-600">{it.title} × {it.quantity}</span>
              <span>{tl(it.line_price_cents)}</span>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between"><span className="text-neutral-500">Ara toplam</span><span>{tl(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Kargo</span><span>{shippingCents == null ? 'İl/ilçe seçin' : tl(ship)}</span></div>
          <div className="flex justify-between font-bold text-base mt-1"><span>Toplam</span><span>{tl(total)}</span></div>
        </div>

        {result && !result.ok && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{result.error}</div>
        )}

        <button
          onClick={submit}
          disabled={!valid || status === 'submitting'}
          className="mt-5 w-full px-6 py-3.5 rounded-full bg-[var(--color-brand-orange)] text-white font-semibold disabled:opacity-50"
        >
          {status === 'submitting' ? 'İşleniyor…' : 'Siparişi Tamamla'}
        </button>
        {!valid && <p className="text-xs text-neutral-400 text-center mt-2">Adres ve ödeme yöntemini doldurun</p>}
      </aside>
    </div>
  );
}
