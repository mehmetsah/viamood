/**
 * META PIXEL — OLAY YAYIM KATMANI (#991406).
 *
 * `pixel-olay.ts` değeri HESAPLAR; bu dosya olayın YAYILIP yayılmayacağına ve
 * kaç kez yayılacağına karar verir. Ayrı durmalarının sebebi ölçülmüş: değer
 * doğru olsa bile Purchase iki kez yayılırsa Meta ciroyu İKİ KAT sayar ve
 * reklam optimizasyonu yanlış öğrenir — sessiz, pahalı bir hata.
 *
 * ÖLÇÜLEN DURUM (3 Eki 2026, Elif · Playwright, canlı viamood.com.tr):
 *   /pages/odeme        → tek olay `trackShopify … PageView`
 *   ürün sayfası        → tek olay `trackShopify … PageView` (18 sn + kaydırma)
 *   InitiateCheckout · Purchase · ViewContent · AddToCart → HİÇBİRİ doğmuyor
 * Kök neden: Shopify'ın kendi checkout'u kullanılmıyor (ödeme tema içi
 * /pages/odeme'de); Web Pixel `checkout_started`/`checkout_completed` yalnız
 * kendi checkout'unda yayılır. Yani iki olay hiç doğmaz, Meta dönüşüm değeri görmez.
 *
 * ⚠ BU DOSYA TARAYICIYA BAĞIMLI DEĞİL: `fbq` ve depolama DIŞARIDAN verilir.
 * Böylece fren gerçek tarayıcı olmadan çivilenebilir — kritik olan da fren.
 */
import { gonderilebilir, type OlayYuku } from './pixel-olay';

/** Tek-yayım damgasının anahtarı. Sipariş NO bazlı: aynı sipariş iki kez sayılmaz. */
export function purchaseAnahtari(siparisNo: string | number): string {
  return `via_fb_purchase_${String(siparisNo).trim()}`;
}

/** Minimal depolama arayüzü — localStorage/sessionStorage ikisi de uyar. */
export type Depo = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
};

export type Fbq = (komut: string, olay: string, yuk?: Record<string, unknown>) => void;

/**
 * InitiateCheckout — ödeme sayfası açıldığında BİR KEZ.
 *
 * Fren sipariş bazlı DEĞİL sayfa-oturumu bazlıdır: henüz sipariş numarası yok.
 * Tekrar yayılması Purchase kadar zararlı değil (ciro saymaz) ama huni sayısını
 * şişirir, o yüzden yine de bir kez.
 */
export function initiateCheckoutYay(fbq: Fbq | null | undefined, yuk: OlayYuku | null, depo: Depo | null, oturumAnahtari = 'via_fb_ic'): boolean {
  if (typeof fbq !== 'function') return false;
  if (!gonderilebilir(yuk)) return false;
  try {
    if (depo && depo.getItem(oturumAnahtari)) return false;
    fbq('track', 'InitiateCheckout', { ...(yuk as object) } as Record<string, unknown>);
    if (depo) depo.setItem(oturumAnahtari, '1');
    return true;
  } catch {
    // Depolama kapalıysa (gizli mod) olay YİNE gider — ölçüm kaybı, satış kaybından iyidir.
    return false;
  }
}

/**
 * Purchase — sipariş GERÇEKTEN oluştuğunda, sipariş numarasıyla, TEK KEZ.
 *
 * ⚠ FREN NEDEN `localStorage`: sessionStorage sekme başına ayrıdır. Müşteri
 * teşekkür sayfasını yeni sekmede açarsa ya da mailden tekrar tıklarsa
 * sessionStorage boş gelir ve Purchase İKİNCİ KEZ yayılır. Sipariş numarası
 * kalıcı bir kimliktir; damgası da kalıcı olmalı.
 */
export function purchaseYay(
  fbq: Fbq | null | undefined,
  yuk: OlayYuku | null,
  siparisNo: string | number | null | undefined,
  depo: Depo | null,
): boolean {
  if (typeof fbq !== 'function') return false;
  if (siparisNo === null || siparisNo === undefined || String(siparisNo).trim() === '') return false;
  if (!gonderilebilir(yuk)) return false;

  const anahtar = purchaseAnahtari(siparisNo);
  try {
    if (depo && depo.getItem(anahtar)) return false; // ÇİFT SAYIM KAPISI
  } catch {
    /* depolama okunamadı — aşağıda yine de yayılır */
  }

  fbq('track', 'Purchase', { ...(yuk as object), order_id: String(siparisNo) } as Record<string, unknown>);

  try {
    if (depo) depo.setItem(anahtar, '1');
  } catch {
    /* damga yazılamadı — olay gitti, tekrar riski gizli modda kalır */
  }
  return true;
}
