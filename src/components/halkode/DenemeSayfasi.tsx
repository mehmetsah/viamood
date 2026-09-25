/**
 * Halköde 10 TL deneme sayfasının gövdesi — TEST ve CANLI ortak.
 *
 * Sunucu bileşeni. Route katmanı yalnız anahtarı doğrulayıp ortamı seçer;
 * ekran buradan çizilir. Tek gövde olmasının sebebi: iki sayfa aynı akışı
 * göstermeli, biri diğerinden sessizce ayrışmamalı. Ortama göre değişen üç şey
 * var — üst şerit, test kartı kutusu ve başarı metni.
 */
import { TEST_KARTI, sonucMetni, type HalkodeOrtam } from '@/lib/halkode/test-page';
import DenemeFormu from './DenemeFormu';

export default function DenemeSayfasi({
  ortam,
  anahtar,
  tutar,
  kalemler,
  sp,
}: {
  ortam: HalkodeOrtam;
  anahtar: string;
  tutar: number;
  kalemler?: ReadonlyArray<{ name: string; price: number; quantity: number }>;
  sp: Record<string, string | string[] | undefined>;
}) {
  const canli = ortam === 'canli';
  const sonucAnahtari = typeof sp.sonuc === 'string' ? sp.sonuc : null;
  const sonuc = sonucAnahtari ? (sonucMetni(ortam)[sonucAnahtari] ?? null) : null;
  const tek = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  return (
    <main className="min-h-screen bg-[var(--color-brand-cream,#faf7f2)] px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        {/* ── ORTAM ŞERİDİ — sayfanın EN ÜSTÜ ──────────────────────────────── */}
        <div
          className={`rounded-xl border px-4 py-3 ${
            canli ? 'border-red-400 bg-red-50 text-red-950' : 'border-amber-300 bg-amber-50 text-amber-950'
          }`}
        >
          <div className="flex gap-2.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                 className={`mt-0.5 shrink-0 ${canli ? 'text-red-700' : 'text-amber-700'}`} aria-hidden="true">
              <path d="M12 4.6 21 20H3z" /><path d="M12 10.2v4M12 17h.01" />
            </svg>
            <div className="text-sm leading-relaxed">
              {canli ? (
                <>
                  <p className="font-bold">CANLI ORTAM — GERÇEK PARA ÇEKİLİR.</p>
                  <p className="mt-1">
                    Bu sayfa Halköde&apos;nin <strong>canlı</strong> sunucusuna bağlıdır. Gireceğin kart
                    gerçek karttır ve <strong>{tutar.toFixed(2)} TL gerçekten çekilir</strong>. Test kartı
                    burada çalışmaz. Çekilen tutar sonradan iade edilebilir.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold">TEST ORTAMI — gerçek para çekilmez.</p>
                  <p className="mt-1">
                    Gerçek kart kullanmayın. Bu sayfa Halköde&apos;nin test sunucusuna bağlıdır ve
                    canlı POS&apos;a bağlanması teknik olarak mümkün değildir.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <header className="mt-6">
          <h1 className="text-2xl font-bold">
            Halköde sanal POS — {tutar.toFixed(2)} TL {canli ? 'canlı deneme' : 'test ödemesi'}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Sepet ya da ürün gerekmez. {canli ? 'Kendi kartınla' : 'Aşağıdaki test kartıyla'} taksit
            seçip 3D doğrulamayı uçtan uca deneyebilirsin.
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
            {/* Ham JSON GÖSTERİLMEZ — yalnız insanın işine yarayan dört alan. */}
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-neutral-700">
              {tek('ref') && (<><dt className="font-semibold">İşlem no</dt><dd className="font-mono">{tek('ref')}</dd></>)}
              {tek('tutar') && (<><dt className="font-semibold">Tutar</dt><dd>{tek('tutar')} TL</dd></>)}
              {tek('kod') && (<><dt className="font-semibold">Halköde kodu</dt><dd>{tek('kod')}</dd></>)}
              {tek('aciklama') && (<><dt className="font-semibold">Banka mesajı</dt><dd>{tek('aciklama')}</dd></>)}
              {/* Teşhis etiketi: "doğrulanamadı" ekranında neden doğrulanamadığını
                  gösterir (yapilandirma / anahtar / jeton). Olmadığında arıza avı
                  ekran görüntüsünden tahmin yürütmeye dönüyordu. */}
              {tek('detay') && (<><dt className="font-semibold">Teşhis</dt><dd className="font-mono">{tek('detay')}</dd></>)}
            </dl>
          </div>
        )}

        {/* ── TEST KARTI — yalnız test ortamında ───────────────────────────── */}
        {!canli && (
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
        )}

        {/* ── CANLI ortamda taksit gerçeği — ölçülerek yazıldı ─────────────── */}
        {canli && (
          <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-bold text-neutral-800">Taksit hakkında</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-700">
              Canlı üye işyerinde taksit şu an <strong>yalnız Halkbank Paraf</strong> kartlarında
              tanımlı (1–12 taksit, vade farkı yok). Diğer bankaların kartlarında yalnız
              <strong> tek çekim</strong> çıkar — bu bir hata değil, üye işyeri tanımıdır.
            </p>
          </section>
        )}

        {/* ── SEPET ÖZETİ — ödemeden ÖNCE, kart formunun hemen üstünde. ──
             Çok kalemli denemenin kanıtı bu blok: Yunus 4 satırı (2 ürün + kargo +
             indirim) ve toplamı EKRANDA görmeli. 3D dönüş sonucuna BAĞLANMAZ;
             sayfa ilk açıldığında görünür. Tek kalemlide `kalemler` gelmez → blok
             hiç çizilmez, eski davranış aynen sürer. */}
        {kalemler && kalemler.length > 0 && (
          <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-bold text-neutral-800">Sepet özeti ({kalemler.length} kalem)</h2>
            <ul className="mt-2 divide-y divide-neutral-100 text-sm leading-relaxed">
              {kalemler.map((k) => (
                <li key={k.name} className="flex items-center justify-between py-1.5">
                  <span className="text-neutral-700">
                    {k.name}
                    {k.quantity > 1 && <span className="text-neutral-500"> × {k.quantity}</span>}
                  </span>
                  <span className="font-medium tabular-nums">{(k.price * k.quantity).toFixed(2)} TL</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-2 text-sm font-bold">
              <span>Toplam</span>
              <span className="tabular-nums">{tutar.toFixed(2)} TL</span>
            </div>
          </div>
        )}

        <DenemeFormu
          sepet={kalemler ? 'coklu' : undefined}
          anahtar={anahtar}
          tutar={tutar}
          ortam={ortam}
          testKarti={canli ? undefined : TEST_KARTI}
        />

        <p className="mt-6 text-center text-xs text-neutral-400">
          Via Mood · Halköde entegrasyon {canli ? 'canlı denemesi' : 'testi'} · bu sayfa arama motorlarına kapalıdır
        </p>
      </div>
    </main>
  );
}
