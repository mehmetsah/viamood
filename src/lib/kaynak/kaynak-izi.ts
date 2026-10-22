/**
 * #994887 · SİPARİŞİN TRAFİK KAYNAĞI (ilk dokunuş + son dokunuş) — SUNUCU SÜZGECİ.
 *
 * ÖLÇÜLEN ARIZA (22 Eki 2026, Elif): Shopify'daki sipariş "Kanal" alanında yalnız
 * siparişi açan uygulamanın adı görünüyordu (Yunus: "Claude yazıyor"). Sebep: siparişler
 * tema içi ödeme sayfasından (`via-checkout`) Admin API ile açılıyor ve kaynak/UTM
 * bilgisi HİÇBİR yerde toplanmıyordu — ne temada, ne sipariş gövdesinde, ne
 * note_attributes'ta. Shopify'ın kendi `landing_site/referring_site` alanları
 * yalnız Shopify checkout'unda dolar; bizim yolumuzda boş kalır.
 *
 * Çözüm iki ayaklı:
 *  - TEMA: `tema-yamalari/994887-kaynak-izi/via-kaynak-izi.js` her sayfada UTM +
 *    yönlendiren alan adı + giriş yolunu yakalar, cihazda saklar; ödeme sayfası
 *    sipariş gövdesine `kaynak: {ilk, son}` olarak koyar.
 *  - SUNUCU (bu dosya): gelen `kaynak` alanı GÜVENİLMEZ girdidir — süzülür,
 *    kısaltılır, kişisel veri izi taşıyabilecek parçalar maskelenir ve siparişe
 *    okunur `note_attributes` + filtrelenebilir `kaynak-<x>` etiketi olarak yazılır.
 *
 * KVKK: yalnız KAYNAK bilgisi taşınır. Tam yönlendiren URL değil yalnız alan adı;
 * giriş sayfasının sorgu dizesi değil yalnız yolu; reklam tıklama kimliğinin
 * (gclid/fbclid…) DEĞERİ değil yalnız türü. UTM değerine e-posta/telefon gömülmüşse
 * maskelenir.
 */

export interface KaynakDokunus {
  /** utm_source ya da türetilmiş kaynak (yönlendiren alan adı / tıklama türü / '(direkt)') */
  kaynak: string;
  ortam: string; // utm_medium ya da türetilmiş ('referral' · 'cpc' · '')
  kampanya: string;
  icerik: string;
  terim: string;
  /** Yalnız alan adı (ör. l.instagram.com) — tam URL ASLA */
  yonlendiren: string;
  /** Giriş sayfasının yolu (ör. /products/elbise) — sorgu dizesi YOK */
  giris: string;
  /** Reklam tıklama kimliğinin TÜRÜ (gclid · fbclid · ttclid · msclkid …) — değeri YOK */
  tiklama: string;
  /** ISO 8601 */
  tarih: string;
}

export interface KaynakKaydi {
  ilk: KaynakDokunus | null;
  son: KaynakDokunus | null;
}

const TIKLAMA_TURU = new Set(['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid']);
const TIKLAMA_KAYNAGI: Record<string, string> = {
  gclid: 'google', gbraid: 'google', wbraid: 'google',
  fbclid: 'facebook', ttclid: 'tiktok', msclkid: 'bing',
};

/** Serbest metin: kontrol karakteri/HTML ayıracı atılır, e-posta/uzun numara maskelenir. */
export function metinSuz(ham: unknown, azami = 100): string {
  if (typeof ham !== 'string') return '';
  return ham
    .replace(/[\u0000-\u001f\u007f<>"'`\\]/g, '')
    .replace(/[^\s@/]+@[^\s@/]+\.[^\s@/]+/g, '[e-posta]')
    .replace(/\+?\d[\d\s-]{8,}\d/g, '[numara]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, azami);
}

function alanAdiSuz(ham: unknown): string {
  if (typeof ham !== 'string') return '';
  const h = ham.trim().toLowerCase();
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h) && h.length <= 253 ? h : '';
}

function yolSuz(ham: unknown): string {
  if (typeof ham !== 'string' || !ham.startsWith('/')) return '';
  const yol = ham.split(/[?#]/)[0];
  return metinSuz(yol, 200);
}

function tarihSuz(ham: unknown): string {
  if (typeof ham !== 'string') return '';
  const t = Date.parse(ham);
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}

function dokunusSuz(ham: unknown): KaynakDokunus | null {
  if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return null;
  const o = ham as Record<string, unknown>;
  const tiklama = typeof o.tiklama === 'string' && TIKLAMA_TURU.has(o.tiklama) ? o.tiklama : '';
  const d: KaynakDokunus = {
    kaynak: metinSuz(o.kaynak).toLowerCase(),
    ortam: metinSuz(o.ortam).toLowerCase(),
    kampanya: metinSuz(o.kampanya),
    icerik: metinSuz(o.icerik),
    terim: metinSuz(o.terim),
    yonlendiren: alanAdiSuz(o.yonlendiren),
    giris: yolSuz(o.giris),
    tiklama,
    tarih: tarihSuz(o.tarih),
  };
  // Kaynak etiketi boşsa elde kalan izden türet; hiç iz yoksa doğrudan giriştir.
  if (!d.kaynak) {
    if (d.ortam || d.kampanya || d.icerik || d.terim) d.kaynak = '(belirtilmemiş)';
    else if (d.tiklama) { d.kaynak = TIKLAMA_KAYNAGI[d.tiklama] ?? d.tiklama; d.ortam = d.ortam || 'cpc'; }
    else if (d.yonlendiren) { d.kaynak = d.yonlendiren; d.ortam = d.ortam || 'referral'; }
    else d.kaynak = '(direkt)';
  }
  return d;
}

/** Gövdedeki `kaynak` alanını süzer. Hiç iz yoksa `null` — siparişe hiçbir şey yazılmaz. */
export function kaynakSuz(ham: unknown): KaynakKaydi | null {
  if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return null;
  const o = ham as Record<string, unknown>;
  const ilk = dokunusSuz(o.ilk);
  const son = dokunusSuz(o.son);
  if (!ilk && !son) return null;
  return { ilk, son };
}

function ozet(d: KaynakDokunus): string {
  const parca = [d.kaynak, d.ortam, d.kampanya].filter(Boolean).join(' / ');
  const ek = [
    d.icerik ? `içerik: ${d.icerik}` : '',
    d.terim ? `terim: ${d.terim}` : '',
    d.tiklama ? `tıklama: ${d.tiklama}` : '',
  ].filter(Boolean);
  return [parca, ...ek].join(' · ');
}

/** Shopify `note_attributes` satırları — sipariş ekranında "Ek ayrıntılar" altında okunur. */
export function kaynakNitelikleri(k: KaynakKaydi | null): Array<{ name: string; value: string }> {
  if (!k) return [];
  const satir: Array<{ name: string; value: string }> = [];
  const yaz = (on: 'ilk' | 'son', d: KaynakDokunus | null) => {
    if (!d) return;
    satir.push({ name: `kaynak_${on}`, value: ozet(d) });
    if (d.yonlendiren) satir.push({ name: `kaynak_${on}_yonlendiren`, value: d.yonlendiren });
    if (d.giris) satir.push({ name: `kaynak_${on}_giris`, value: d.giris });
    if (d.tarih) satir.push({ name: `kaynak_${on}_tarih`, value: d.tarih });
  };
  yaz('ilk', k.ilk);
  yaz('son', k.son);
  return satir;
}

/** Sipariş listesinde filtrelenebilir tek etiket: son dokunuşun kaynağı (yoksa ilk). */
export function kaynakEtiketi(k: KaynakKaydi | null): string | null {
  const d = k?.son ?? k?.ilk;
  if (!d) return null;
  const slug = d.kaynak
    .replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug ? `kaynak-${slug}` : null;
}

/**
 * Kart yollarının (iyzico · PayTR · Halköde) taslak siparişine eklenecek iki alan.
 * Taslak `complete` edilince note_attributes ve etiketler siparişe aynen geçer.
 * Kaynak izi yoksa `note_attributes` HİÇ eklenmez, etiketler değişmez.
 */
export function taslakKaynakAlanlari(
  ham: unknown,
  etiketler: string,
): { tags: string; note_attributes?: Array<{ name: string; value: string }> } {
  const k = kaynakSuz(ham);
  const etk = kaynakEtiketi(k);
  const nit = kaynakNitelikleri(k);
  return { tags: etk ? `${etiketler},${etk}` : etiketler, ...(nit.length ? { note_attributes: nit } : {}) };
}
