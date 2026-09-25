'use client';

/**
 * Halköde 3D doğrulama — SİTE İÇİ ÇERÇEVE.
 *
 * NEDEN (Yunus, Viamood karar mercii): "Paytr gibi direk site içerisinde iframe
 * gözükecekse yapalım, ayrı linke yönlendirmek doğru olmaz."
 * Önceki davranış `document.open(); document.write(form_html)` idi — banka formu TÜM
 * sayfayı eziyor, müşteri siteden çıkmış gibi oluyordu.
 *
 * 🔴 EMNİYET SUBABI (zorunlu): bankanın ACS sayfası X-Frame-Options / CSP
 * frame-ancestors ile çerçevelenmeyi reddedebilir — o zaman iframe BOŞ kalır ve
 * müşteri beyaz ekranda asılı kalır. Bu yüzden çerçeve ölçülür: belirlenen süre
 * içinde yükleme sinyali gelmezse ESKİ davranışa (tam sayfa) kendiliğinden düşülür.
 * Müşteri asla boş ekranda bırakılmaz. Düşüş olursa sunucuya iz bırakılır ki hangi
 * bankanın çerçeveyi reddettiğini ölçebilelim.
 *
 * KART VERİSİ: bu bileşene kart bilgisi GEÇMEZ. Aldığı tek şey bankanın döndürdüğü
 * auto-submit HTML'idir; log'a, hata metnine, rapora kart alanı yazılmaz.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Çerçevenin yüklendiğine dair sinyal beklenen süre. Aşılırsa tam sayfaya düşülür. */
const ZAMAN_ASIMI_MS = 8000;

type Props = {
  /** Bankadan gelen auto-submit 3D formu (HTML). */
  formHtml: string;
  /** Teşhis için: hangi işlem/banka çerçeveyi reddetti. Kart verisi İÇERMEZ. */
  iz?: { invoiceId?: string; posBank?: string; kaynak: 'odeme' | 'deneme' };
  /** Başlık metni — sayfanın kendi diline uysun diye dışarıdan verilir. */
  baslik?: string;
};

/** Tam sayfa davranışı: çerçeve kurulamazsa eski, çalıştığı bilinen yola dönülür. */
function tamSayfayaDus(formHtml: string) {
  document.open();
  document.write(formHtml);
  document.close();
}

export default function Halkode3DCerceve({ formHtml, iz, baslik = 'Güvenli doğrulama' }: Props) {
  const [yuklendi, setYuklendi] = useState(false);
  const dustuRef = useRef(false);
  const cerceveRef = useRef<HTMLIFrameElement | null>(null);

  /** Sunucuya iz bırak — hangi banka çerçeveyi reddediyor, ölçebilelim. Sessiz başarısız olur. */
  const izBirak = useCallback(
    (sebep: string) => {
      try {
        const govde = JSON.stringify({ sebep, ...iz });
        // keepalive: sayfa hemen tam-sayfaya düşeceği için istek yarıda kalmasın.
        void fetch('/api/v1/payment/halkode/cerceve-raporu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: govde,
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* teşhis kaydı ödeme akışını asla bozmaz */
      }
    },
    [iz],
  );

  useEffect(() => {
    // Çerçeve yüklenme sinyali vermezse tam sayfaya düş.
    const t = setTimeout(() => {
      if (yuklendi || dustuRef.current) return;
      dustuRef.current = true;
      izBirak('zaman_asimi');
      tamSayfayaDus(formHtml);
    }, ZAMAN_ASIMI_MS);
    return () => clearTimeout(t);
  }, [formHtml, yuklendi, izBirak]);

  // Banka bizim origin'imize döndüğünde (callback) çerçeveden çıkış haberi gelir.
  useEffect(() => {
    function dinle(e: MessageEvent) {
      const d = e.data as { vmHalkode?: string; url?: string } | null;
      if (!d || d.vmHalkode !== 'sonuc' || !d.url) return;
      window.location.replace(d.url);
    }
    window.addEventListener('message', dinle);
    return () => window.removeEventListener('message', dinle);
  }, []);

  function onLoad() {
    // Banka sayfası çerçevelenmeyi reddettiyse tarayıcı boş bir belge yükler.
    // Aynı origin olmadığı için içerik OKUNAMAZ; okunabiliyorsa ve boşsa → reddedilmiştir.
    setYuklendi(true);
    try {
      const b = cerceveRef.current?.contentDocument?.body;
      if (b && b.innerHTML.trim() === '' && !dustuRef.current) {
        dustuRef.current = true;
        izBirak('bos_icerik');
        tamSayfayaDus(formHtml);
      }
    } catch {
      /* cross-origin okunamıyor = banka sayfası GERÇEKTEN yüklendi, iyi işaret */
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-neutral-800">{baslik}</h2>
        <span className="text-xs text-neutral-500">Bankanızın 3D Secure ekranı</span>
      </div>

      <div className="relative mt-3 w-full overflow-hidden rounded-lg border border-neutral-200">
        {!yuklendi && (
          // Yükleniyor iskeleti — çerçeve gelene kadar ekran boş görünmesin.
          <div className="absolute inset-0 grid place-items-center bg-neutral-50" aria-hidden="true">
            <div className="w-full max-w-sm space-y-3 p-6">
              <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-200" />
              <div className="h-3 w-full animate-pulse rounded bg-neutral-200" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-neutral-200" />
              <div className="h-9 w-full animate-pulse rounded bg-neutral-200" />
            </div>
          </div>
        )}
        <iframe
          ref={cerceveRef}
          title="Halköde 3D Secure doğrulama"
          srcDoc={formHtml}
          onLoad={onLoad}
          // allow-top-navigation: 3D bitince banka/callback müşteriyi sonuç sayfasına
          // ÜST pencereden çıkarmalı; olmazsa müşteri çerçevede hapis kalır.
          sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation allow-top-navigation-by-user-activation"
          className="block h-[560px] w-full bg-white"
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-neutral-500">
        Doğrulama bankanızın ekranında yapılır. Kart bilgileriniz Via Mood&apos;da kaydedilmez.
      </p>
    </div>
  );
}
