'use client';

import { useState } from 'react';

interface Sonuc {
  ok: boolean;
  error?: string;
  detay?: string;
  kayit_id?: string;
  invoice_id?: string;
  tutar_tl?: number;
  status_code?: number;
  aciklama?: string;
  siparis?: string | null;
  shopify_not?: string | null;
}

export default function IadeForm() {
  const [islemNo, setIslemNo] = useState('');
  const [siparisNo, setSiparisNo] = useState('');
  const [tutar, setTutar] = useState('');
  const [not, setNot] = useState('');
  const [onay, setOnay] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  const tutarSayi = Number(tutar.replace(',', '.'));
  const gecerli = Number.isFinite(tutarSayi) && tutarSayi > 0 && (islemNo.trim() || siparisNo.trim()) && onay;

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!gecerli || yukleniyor) return;
    setYukleniyor(true);
    setSonuc(null);
    try {
      const r = await fetch('/api/admin/payment/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: islemNo.trim() || undefined,
          order_no: siparisNo.trim() || undefined,
          amount: tutarSayi,
          note: not.trim() || undefined,
        }),
      });
      setSonuc((await r.json()) as Sonuc);
      setOnay(false); // her gönderimde yeniden onay — kazara ikinci iade olmasın
    } catch (err) {
      setSonuc({ ok: false, error: 'baglanti', detay: err instanceof Error ? err.message : String(err) });
    } finally {
      setYukleniyor(false);
    }
  }

  const input = 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm';

  return (
    <form onSubmit={gonder} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium mb-1">Halköde İşlem No (invoice_id)</label>
        <input className={input} value={islemNo} onChange={(e) => setIslemNo(e.target.value)} placeholder="vm0ttmu5dtwkm" />
        <p className="text-xs text-neutral-500 mt-1">
          Halköde panelindeki işlem numarası. Biliniyorsa en güvenilir yol budur.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">veya Sipariş No</label>
        <input className={input} value={siparisNo} onChange={(e) => setSiparisNo(e.target.value)} placeholder="1115" />
        <p className="text-xs text-neutral-500 mt-1">
          İşlem no bilinmiyorsa: aynı siparişe ait daha önce bir iade yapıldıysa oradan bulunur.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">İade Tutarı (TL)</label>
        <input className={input} value={tutar} onChange={(e) => setTutar(e.target.value)} placeholder="10.00" inputMode="decimal" />
        <p className="text-xs text-neutral-500 mt-1">
          Tutar işlemin tamamıysa iptal, azsa kısmi iade olarak işlenir.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Açıklama</label>
        <textarea className={input} rows={2} value={not} onChange={(e) => setNot(e.target.value)} placeholder="Müşteri ürünü iade etti" />
      </div>

      {/* Kazara tıklamayı engelleyen ikinci kapı: para çıkışı tek tıkla olmaz. */}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={onay} onChange={(e) => setOnay(e.target.checked)} className="mt-1" />
        <span>
          <strong>{Number.isFinite(tutarSayi) && tutarSayi > 0 ? `${tutarSayi.toFixed(2)} TL` : '—'}</strong> tutarında
          gerçek para iadesi yapılacağını onaylıyorum. Bu işlem geri alınamaz.
        </span>
      </label>

      <button
        type="submit"
        disabled={!gecerli || yukleniyor}
        className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-40"
      >
        {yukleniyor ? 'Gönderiliyor…' : 'İadeyi Gönder'}
      </button>

      {sonuc && (
        <div className={`rounded-lg border p-3 text-sm ${sonuc.ok ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
          <p className="font-medium">{sonuc.ok ? 'İade başarılı' : 'İade yapılamadı'}</p>
          {sonuc.aciklama && <p className="mt-1">Banka cevabı: {sonuc.aciklama}</p>}
          {sonuc.detay && <p className="mt-1">{sonuc.detay}</p>}
          {sonuc.error && !sonuc.detay && <p className="mt-1">Sebep: {sonuc.error}</p>}
          <dl className="mt-2 text-xs text-neutral-600 space-y-0.5">
            {sonuc.invoice_id && <div>İşlem no: {sonuc.invoice_id}</div>}
            {sonuc.siparis && <div>Sipariş: {sonuc.siparis}</div>}
            {sonuc.status_code != null && <div>Durum kodu: {sonuc.status_code}</div>}
            {sonuc.shopify_not && <div>Shopify notu: {sonuc.shopify_not}</div>}
            {sonuc.kayit_id && <div>Kayıt: {sonuc.kayit_id}</div>}
          </dl>
        </div>
      )}
    </form>
  );
}
