'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ILLER, getIlceler } from '@/lib/tr-addresses';
// ⚠️ PaymentSettings DEĞİL: bu bileşen istemcide çalışıyor ve prop'u RSC yüküyle
// HTML'e gömülüyor. Tip daraltıldı ki sır içeren bir alan buraya kazara geçmesin
// (bkz. lib/settings/store.ts → vitrinOdemeAyarlari).
import type { VitrinOdemeAyarlari } from '@/lib/settings/store';

interface CartView {
  token: string;
  item_count: number;
  items: { variant_id: string; quantity: number; title: string; line_price_cents: number }[];
  items_subtotal_cents: number;
}

const tl = (c: number) => (c / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
const inputCls =
  'h-11 w-full px-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-[var(--color-brand-orange)]';

type Method = 'havale' | 'cod' | 'card';

/**
 * Kart ödemesi — YALNIZ Halköde uygulandı.
 * İyzico/PayTR bu native checkout'ta HİÇ bağlanmamıştı (aşağıda "yakında" yer tutucusu
 * duruyordu, hiçbir initialize çağrısı yoktu); canlı kart ödemesi Shopify temasındaki
 * via-checkout.liquid üzerinden akıyor. Bu yüzden burada "üçüncü dal" eklenemedi —
 * kart yolu ilk kez Halköde için kuruldu. Gateway 'iyzico'/'paytr' iken davranış
 * DEĞİŞMEDİ: eski yer tutucu aynen gösterilir.
 */
const CARD_GATEWAY_LABEL: Record<string, string> = {
  halkode: 'Halkbank (Halköde)',
  iyzico: 'İyzico',
  paytr: 'PayTR',
};

export function CheckoutForm({ payment }: { payment: VitrinOdemeAyarlari }) {
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

  // Kart (Halköde) — SAKLANMAZ, yalnız initialize'a iletilir
  const [card, setCard] = useState({ holder: '', no: '', month: '', year: '', cvv: '' });
  const [installments, setInstallments] = useState<{ installments_number: number; amount_to_be_paid: string }[]>([]);
  const [selectedInstallment, setSelectedInstallment] = useState(1);

  const ilceler = useMemo(() => (il ? getIlceler(il) : []), [il]);

  const gateway = payment.card_gateway ?? 'iyzico';
  // Kart formu şu an YALNIZ Halköde için uygulandı (yukarıdaki nota bakın).
  // İyzico/PayTR seçiliyken eski "yakında" yer tutucusu aynen gösterilir.
  const cardImplemented = gateway === 'halkode' && !!payment.halkode_enabled;

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

  // Kart BIN'i (ilk 6 hane) girilince taksit tablosunu çek — tam kart no GÖNDERİLMEZ
  const bin = card.no.replace(/\D/g, '').slice(0, 6);
  useEffect(() => {
    if (!cardImplemented || method !== 'card' || bin.length < 6 || total <= 0) {
      setInstallments([]);
      return;
    }
    let iptal = false;
    fetch('/api/v1/payment/halkode/installments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bin, amount: total / 100 }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!iptal) setInstallments(d.ok && Array.isArray(d.installments) ? d.installments : []);
      })
      .catch(() => !iptal && setInstallments([]));
    return () => {
      iptal = true;
    };
  }, [cardImplemented, method, bin, total]);

  const cardValid =
    method !== 'card' ||
    (card.no.replace(/\D/g, '').length >= 15 && card.month && card.year && card.cvv.length >= 3 && card.holder);

  const valid =
    f.first_name && f.last_name && f.phone && f.email.includes('@') && f.address1 && il && ilce && method && cardValid;

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

      // 2a) KART (Halköde) → initialize; başarıda bankaya auto-submit eden 3D formu döner
      if (method === 'card') {
        const res = await fetch('/api/v1/payment/halkode/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line_items: (cart.items ?? []).map((it) => ({
              variant_id: Number(it.variant_id),
              quantity: it.quantity,
              title: it.title,
              // initialize BİRİM fiyatı kuruş olarak bekler; sepet SATIR toplamı tutuyor
              price: it.quantity > 0 ? Math.round(it.line_price_cents / it.quantity) : 0,
            })),
            shipping_cost: ship / 100,
            first_name: f.first_name,
            last_name: f.last_name,
            phone: f.phone,
            email: f.email,
            address1: f.address1,
            city: ilce, // Shopify şeması: city = ilçe
            province: il,
            zip: f.postal_code,
            cc_holder_name: card.holder,
            cc_no: card.no.replace(/\D/g, ''),
            expiry_month: card.month,
            expiry_year: card.year,
            cvv: card.cvv,
            installments_number: selectedInstallment,
          }),
        });
        const d = await res.json();
        if (d.ok && d.form_html) {
          // 3D formu kendi kendine banka sayfasına POST eder — innerHTML script çalıştırmaz,
          // bu yüzden belge doğrudan yazılır (PSP entegrasyonlarının standart yolu).
          document.open();
          document.write(d.form_html);
          document.close();
          return; // sayfa bankaya gidiyor
        }
        setResult({ ok: false, error: d.detail || d.error || 'Kart ödemesi başlatılamadı' });
        return;
      }

      // 2b) Siparişe dönüştür (havale/COD → native sipariş)
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
  }, [cart, valid, method, f, il, ilce, mahalle, ship, card, selectedInstallment]);

  if (result?.ok) {
    return (
      <div className="bg-white rounded-2xl border p-10 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">Siparişin alındı!</h2>
        <p className="text-neutral-600">
          Sipariş numaran: <strong>{result.orderCode}</strong>
        </p>
        <p className="text-sm text-neutral-500 mt-2">
          {method === 'havale' ? 'Havale bilgileri e-postana gönderildi.' : method === 'cod' ? 'Kapıda ödeme ile teslim edilecek.' : 'Ödemen alındı.'}
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
            {cardImplemented && (
              <div className="border rounded-lg overflow-hidden">
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <input type="radio" name="m" checked={method === 'card'} onChange={() => setMethod('card')} />
                  <span className="font-medium text-sm">
                    Kredi / banka kartı <span className="text-neutral-400">· {CARD_GATEWAY_LABEL[gateway]}</span>
                  </span>
                </label>
                {method === 'card' && (
                  <div className="px-4 pb-4 pt-1 border-t bg-neutral-50/60 flex flex-col gap-3">
                    <input className={inputCls} placeholder="Kart üzerindeki isim" autoComplete="cc-name"
                      value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} />
                    <input className={inputCls} placeholder="Kart numarası" inputMode="numeric" autoComplete="cc-number"
                      value={card.no} onChange={(e) => setCard({ ...card, no: e.target.value })} />
                    <div className="grid grid-cols-3 gap-3">
                      <input className={inputCls} placeholder="Ay (12)" inputMode="numeric" autoComplete="cc-exp-month"
                        value={card.month} onChange={(e) => setCard({ ...card, month: e.target.value })} />
                      <input className={inputCls} placeholder="Yıl (2028)" inputMode="numeric" autoComplete="cc-exp-year"
                        value={card.year} onChange={(e) => setCard({ ...card, year: e.target.value })} />
                      <input className={inputCls} placeholder="CVV" inputMode="numeric" autoComplete="cc-csc"
                        value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value })} />
                    </div>
                    {installments.length > 1 && (
                      <div>
                        <label className="text-xs font-medium block mb-1">Taksit</label>
                        <select className={inputCls} value={selectedInstallment}
                          onChange={(e) => setSelectedInstallment(Number(e.target.value))}>
                          {installments.map((i) => (
                            <option key={i.installments_number} value={i.installments_number}>
                              {i.installments_number === 1 ? 'Tek çekim' : `${i.installments_number} taksit`} — {i.amount_to_be_paid} ₺
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <p className="text-xs text-neutral-500">
                      Ödeme, bankanın 3D Secure sayfasına yönlendirilerek tamamlanır. Kart bilgileriniz saklanmaz.
                    </p>
                  </div>
                )}
              </div>
            )}
            {(payment.iyzico_enabled || payment.paytr_enabled) && !cardImplemented && (
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
