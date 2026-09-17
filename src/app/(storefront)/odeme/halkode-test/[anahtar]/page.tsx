/**
 * /odeme/halkode-test/<anahtar> — Halköde 10 TL test ödeme sayfası.
 *
 * Sunucu bileşeni: anahtarı doğrular, önizleme çerezini kurar, noindex verir.
 * Form ve taksit tablosu istemci bileşeninde (etkileşim gerekiyor).
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TEST_ANAHTAR, TEST_TUTAR_TL, TEST_KARTI, SONUC_METNI } from '@/lib/halkode/test-page';
import TestOdemeFormu from './TestOdemeFormu';

export const dynamic = 'force-dynamic';

/** Arama motorlarına KAPALI — canlı müşteri buraya aramadan düşmesin. */
export const metadata: Metadata = {
  title: 'Halköde test ödemesi',
  robots: { index: false, follow: false, nocache: true },
};

export default async function Sayfa({
  params,
  searchParams,
}: {
  params: Promise<{ anahtar: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { anahtar } = await params;
  const sp = await searchParams;

  // Yanlış anahtar → 404. "Yetkisiz" demek bile sayfanın VAR olduğunu ele verir.
  if (anahtar !== TEST_ANAHTAR) notFound();

  // ÇEREZ BURADA KURULMAZ — middleware'de kurulur (src/middleware.ts).
  // Sunucu bileşeni çerez YAZAMIYOR: Next "Cookies can only be modified in a
  // Server Action or Route Handler" ile 500 veriyor. İlk deneme canlıda tam bu
  // hatayla düştü; varsayımla değil hata günlüğüyle bulundu.

  const sonucAnahtari = typeof sp.sonuc === 'string' ? sp.sonuc : null;
  const sonuc = sonucAnahtari ? (SONUC_METNI[sonucAnahtari] ?? null) : null;
  const tek = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  return (
    <main className="min-h-screen bg-[var(--color-brand-cream,#faf7f2)] px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        {/* ── TEST ŞERİDİ — sayfanın EN ÜSTÜ ───────────────────────────────── */}
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          <div className="flex gap-2.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                 className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true">
              <path d="M12 4.6 21 20H3z" /><path d="M12 10.2v4M12 17h.01" />
            </svg>
            <div className="text-sm leading-relaxed">
              <p className="font-bold">TEST ORTAMI — gerçek para çekilmez.</p>
              <p className="mt-1">
                Gerçek kart kullanmayın. Bu sayfa Halköde&apos;nin test sunucusuna bağlıdır ve
                canlı POS&apos;a bağlanması teknik olarak mümkün değildir.
              </p>
            </div>
          </div>
        </div>

        <header className="mt-6">
          <h1 className="text-2xl font-bold">Halköde sanal POS — {TEST_TUTAR_TL.toFixed(2)} TL test ödemesi</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Sepet ya da ürün gerekmez. Aşağıdaki test kartıyla taksit seçip 3D doğrulamayı
            uçtan uca deneyebilirsin.
          </p>
        </header>

        {/* ── 3D DÖNÜŞ SONUCU (varsa) ──────────────────────────────────────── */}
        {sonuc && (
          <div
            className={`mt-6 rounded-xl border px-4 py-4 ${
              sonuc.iyi ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
            }`}
          >
            <p className={`font-bold ${sonuc.iyi ? 'text-green-900' : 'text-red-900'}`}>{sonuc.baslik}</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-800">{sonuc.aciklama}</p>
            {/* Ham JSON GÖSTERİLMEZ — yalnız insanın işine yarayan üç alan. */}
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-neutral-700">
              {tek('ref') && (<><dt className="font-semibold">İşlem no</dt><dd className="font-mono">{tek('ref')}</dd></>)}
              {tek('tutar') && (<><dt className="font-semibold">Tutar</dt><dd>{tek('tutar')} TL</dd></>)}
              {tek('kod') && (<><dt className="font-semibold">Halköde kodu</dt><dd>{tek('kod')}</dd></>)}
              {tek('aciklama') && (<><dt className="font-semibold">Banka mesajı</dt><dd>{tek('aciklama')}</dd></>)}
            </dl>
          </div>
        )}

        {/* ── TEST KARTI ───────────────────────────────────────────────────── */}
        <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-bold text-neutral-800">Test kartı</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-neutral-500">Kart no</dt>
            <dd className="font-mono font-semibold">{TEST_KARTI.no}</dd>
            <dt className="text-neutral-500">Son kullanma</dt>
            <dd className="font-mono">{TEST_KARTI.ay} / {TEST_KARTI.yil}</dd>
            <dt className="text-neutral-500">CVV</dt>
            <dd className="font-mono">{TEST_KARTI.cvv}</dd>
            <dt className="text-neutral-500">Ad soyad</dt>
            <dd className="font-mono">{TEST_KARTI.sahip}</dd>
          </dl>
          <p className="mt-2 text-xs text-neutral-500">{TEST_KARTI.not}</p>
        </section>

        <TestOdemeFormu anahtar={TEST_ANAHTAR} tutar={TEST_TUTAR_TL} testKarti={TEST_KARTI} />

        <p className="mt-6 text-center text-xs text-neutral-400">
          Via Mood · Halköde entegrasyon testi · bu sayfa arama motorlarına kapalıdır
        </p>
      </div>
    </main>
  );
}
