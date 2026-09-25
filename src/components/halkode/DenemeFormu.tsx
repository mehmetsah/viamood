'use client';

/**
 * 10 TL deneme ödeme formu + taksit tablosu. TEST ve CANLI sayfa AYNI bileşeni
 * kullanır — tek fark `ortam` ve test kartı düğmesinin olup olmaması.
 *
 * AKIŞ:
 *   kart no ≥6 hane  → /installments (BIN ile) → taksit tablosu çizilir
 *   "Öde" → /test-initialize → Halköde'nin BANKA formu HTML'i → belgeye yazılır
 *   banka 3D'den sonra → /test-callback → sayfaya ?sonuc=… ile döner
 *
 * ⚠️ TUTAR SUNUCUDAN: burada gösterilen tutar yalnız ekran içindir; imzayı
 * sunucu kendi sabitinden üretir. İstemcide tutar değiştirilse bile ödeme
 * yine 10 TL olur. Canlı ortamda bu tek başına en önemli koruma.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Halkode3DCerceve from './Halkode3DCerceve';

interface Taksit {
  installments_number: number;
  amount_to_be_paid: string;
  payable_amount: number;
  card_program?: string;
  card_scheme?: string;
  title?: string | number;
}

const tl = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';

export default function DenemeFormu({
  anahtar,
  tutar,
  ortam,
  sepet,
  testKarti,
}: {
  anahtar: string;
  tutar: number;
  /** Yalnız SEÇİM: 'coklu' → sunucudaki sabit çok kalemli sepet. */
  sepet?: 'coklu';
  ortam: 'test' | 'canli';
  /** Yalnız TEST sayfasında verilir — canlı POS test kartını tanımaz. */
  testKarti?: { no: string; sahip: string; ay: string; yil: string; cvv: string };
}) {
  const canli = ortam === 'canli';
  const [kartNo, setKartNo] = useState('');
  const [sahip, setSahip] = useState('');
  const [ay, setAy] = useState('');
  const [yil, setYil] = useState('');
  const [cvv, setCvv] = useState('');
  const [taksitler, setTaksitler] = useState<Taksit[] | null>(null);
  const [taksitYukleniyor, setTaksitYukleniyor] = useState(false);
  const [taksitHata, setTaksitHata] = useState<string | null>(null);
  const [secili, setSecili] = useState(1);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  // Yunus aynı deneyimi görsün: 3D burada da site içi çerçevede açılır.
  const [uc3d, setUc3d] = useState<string | null>(null);
  const sonBin = useRef('');

  const rakam = (v: string) => v.replace(/\D/g, '');

  /** BIN değişince taksit tablosunu tazele. Aynı BIN için tekrar sorulmaz. */
  const taksitGetir = useCallback(
    async (bin: string) => {
      if (bin.length < 6 || sonBin.current === bin) return;
      sonBin.current = bin;
      setTaksitYukleniyor(true);
      setTaksitHata(null);
      try {
        const r = await fetch('/api/v1/payment/halkode/installments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bin, amount: tutar }),
        });
        const j = (await r.json()) as { ok: boolean; installments?: Taksit[]; error?: string };
        if (!j.ok) {
          setTaksitler(null);
          setTaksitHata(
            j.error === 'Halköde kapalı.'
              ? 'Halköde kapalı görünüyor — sayfayı linkten tekrar aç.'
              : `Taksit tablosu alınamadı: ${j.error ?? 'bilinmeyen hata'}`,
          );
          return;
        }
        const liste = (j.installments ?? []).slice().sort((a, b) => a.installments_number - b.installments_number);
        setTaksitler(liste);
        setSecili(liste[0]?.installments_number ?? 1);
      } catch {
        setTaksitler(null);
        setTaksitHata('Taksit servisine ulaşılamadı.');
      } finally {
        setTaksitYukleniyor(false);
      }
    },
    [tutar],
  );

  useEffect(() => {
    const bin = rakam(kartNo).slice(0, 6);
    if (bin.length === 6) void taksitGetir(bin);
    if (bin.length < 6) { sonBin.current = ''; setTaksitler(null); setTaksitHata(null); }
  }, [kartNo, taksitGetir]);

  function testKartiniDoldur() {
    if (!testKarti) return;
    setKartNo(testKarti.no);
    setSahip(testKarti.sahip);
    setAy(testKarti.ay);
    setYil(testKarti.yil);
    setCvv(testKarti.cvv);
  }

  async function ode(e: React.FormEvent) {
    e.preventDefault();
    // CANLI ortamda kazara tıklamaya karşı tek adımlık onay. Tutar zaten
    // sunucuda sabit ve küçük; buradaki amaç "ne yaptığını bil" uyarısı.
    if (canli && !window.confirm(`Bu CANLI bir ödemedir. Kartından ${tl(tutar)} gerçekten çekilecek. Devam edilsin mi?`)) {
      return;
    }
    setHata(null);
    setGonderiliyor(true);
    try {
      const r = await fetch('/api/v1/payment/halkode/test-initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(sepet ? { sepet } : {}),
          anahtar,
          installments_number: secili,
          cc_holder_name: sahip,
          cc_no: rakam(kartNo),
          expiry_month: ay,
          expiry_year: yil,
          cvv,
        }),
      });
      const j = (await r.json()) as { ok: boolean; html?: string; error?: string; statusCode?: number };
      if (!j.ok || !j.html) {
        setHata(
          j.statusCode
            ? `Halköde işlemi başlatmadı (kod ${j.statusCode}): ${j.error ?? ''}`
            : (j.error ?? 'İşlem başlatılamadı.'),
        );
        setGonderiliyor(false);
        return;
      }
      // ESKİDEN: document.write tüm sayfayı eziyordu. ARTIK: site içi çerçeve
      // (Halkode3DCerceve). Banka çerçeveyi reddederse bileşen tam sayfaya düşer.
      setUc3d(j.html);
      setGonderiliyor(false);
    } catch {
      setHata('Sunucuya ulaşılamadı.');
      setGonderiliyor(false);
    }
  }

  const hazir = rakam(kartNo).length >= 15 && sahip.trim().length >= 3 && ay.length === 2 && yil.length === 4 && cvv.length >= 3;

  // 3D açıldığında form yerine çerçeve gösterilir; sayfanın kendisi (başlık, tutar) kalır.
  if (uc3d) {
    return <Halkode3DCerceve formHtml={uc3d} iz={{ kaynak: 'deneme' }} baslik="Ödemenizi doğrulayın" />;
  }

  return (
    <form onSubmit={ode} className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-neutral-800">Kart bilgileri</h2>
        {testKarti && (
          <button type="button" onClick={testKartiniDoldur}
                  className="text-xs font-semibold text-[var(--color-brand-orange,#f25334)] hover:underline">
            Test kartını doldur
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-neutral-500">Kart numarası</span>
          <input inputMode="numeric" autoComplete="off" value={kartNo} maxLength={19}
                 onChange={(e) => setKartNo(rakam(e.target.value))}
                 placeholder={canli ? 'Kendi kartının numarası' : '4155 6501 0041 6111'}
                 className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 font-mono" />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-neutral-500">Kart üzerindeki isim</span>
          <input value={sahip} onChange={(e) => setSahip(e.target.value)} autoComplete="off"
                 className="rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        {/* min-w-0: grid sutunlari varsayilan olarak min-content genisliginde
            kalmiyor; input'un kendi min genisligi sutunu tasiriyordu (420px'de
            ekran goruntusuyle gorulmustu). */}
        <div className="grid grid-cols-3 gap-3">
          <label className="grid min-w-0 gap-1">
            <span className="text-xs text-neutral-500">Ay</span>
            <input inputMode="numeric" maxLength={2} value={ay} onChange={(e) => setAy(rakam(e.target.value))}
                   placeholder="12" className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 font-mono" />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-xs text-neutral-500">Yıl</span>
            <input inputMode="numeric" maxLength={4} value={yil} onChange={(e) => setYil(rakam(e.target.value))}
                   placeholder="2028" className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 font-mono" />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="text-xs text-neutral-500">CVV</span>
            <input inputMode="numeric" maxLength={4} value={cvv} onChange={(e) => setCvv(rakam(e.target.value))}
                   placeholder="555" className="w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 font-mono" />
          </label>
        </div>
      </div>

      {/* ── TAKSİT TABLOSU ──────────────────────────────────────────────── */}
      <div className="mt-5">
        <h3 className="text-sm font-bold text-neutral-800">Taksit seçenekleri</h3>
        {rakam(kartNo).length < 6 && (
          <p className="mt-1 text-xs text-neutral-500">
            Kartın ilk 6 hanesini girince karta tanımlı taksitler burada listelenir.
          </p>
        )}
        {taksitYukleniyor && <p className="mt-2 text-xs text-neutral-500">Taksit tablosu alınıyor…</p>}
        {taksitHata && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {taksitHata}
          </p>
        )}
        {taksitler && taksitler.length > 0 && (
          /* TAKSİT — örnekteki KARE IZGARA (Ayşe #76; ölçülen tek yapısal fark, kart #990862).
             Liste get-installments ucundan gelir, sabit kodlama YOK.
             Satır yükseklikleri leading-relaxed — #102 eşiği 1.3. */
          /* Ayşe hükümleri ayse:121/122/123 — kırılım kapsayıcıya bağlı, kutu min-h 72px,
             köşe 8px (referanstaki 10px'e bilinçli uyulmuyor). Bkz. CheckoutForm. */
          <ul className="@container mt-2 grid grid-cols-3 gap-2 p-3 @[300px]:grid-cols-4 @[500px]:grid-cols-6">
            {taksitler.map((t) => {
              const n = t.installments_number;
              const toplam = parseFloat(t.amount_to_be_paid) || tutar;
              const aylik = n > 1 ? toplam / n : toplam;
              return (
                <li key={`${n}-${t.card_program ?? ''}`}>
                  <label className={`flex h-full min-h-[72px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-center leading-relaxed ${
                    secili === n
                      ? 'border-[var(--color-brand-orange,#f25334)] bg-orange-50'
                      : 'border-neutral-200 hover:border-neutral-400'
                  }`}>
                    <input type="radio" name="taksit" className="sr-only" checked={secili === n} onChange={() => setSecili(n)} />
                    <span className="text-xs font-semibold leading-relaxed">
                      {n === 1 ? 'Tek çekim' : `${n} taksit`}
                    </span>
                    <span className="text-[11px] font-bold leading-relaxed">{tl(toplam)}</span>
                    {n > 1 && <span className="text-[11px] leading-relaxed text-neutral-500">{tl(aylik)} × {n}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {taksitler && taksitler.length === 0 && (
          <p className="mt-2 text-xs text-neutral-500">Bu karta tanımlı taksit bulunamadı; tek çekim ile denenecek.</p>
        )}
      </div>

      {hata && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hata}</p>
      )}

      <button type="submit" disabled={!hazir || gonderiliyor} aria-busy={gonderiliyor}
              className={`mt-5 w-full rounded-full px-6 py-3 font-semibold text-white disabled:opacity-40 ${
                canli ? 'bg-red-700' : 'bg-neutral-900'
              }`}>
        {gonderiliyor
          ? 'Bankaya yönlendiriliyor…'
          : canli
            ? `${tl(tutar)} GERÇEKTEN öde (3D doğrulama)`
            : `${tl(tutar)} öde (3D doğrulama)`}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">
        Tutar sunucuda sabittir; bu ekranda değiştirilemez.
      </p>
    </form>
  );
}
