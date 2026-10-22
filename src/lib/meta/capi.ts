/**
 * META CONVERSIONS API (CAPI) · SUNUCU Purchase — #994827, 22 Eki 2026 (Elif).
 *
 * NEDEN: tarayıcı Purchase'ı (tema `via-order-success.liquid`, #994753) reklam
 * engelleyici / iOS ITP / sekmeyi erken kapatma yüzünden kaybolabiliyor. Sunucu
 * aynı satın almayı Graph API `/{pixel_id}/events` ile ikinci kez bildirir; Meta
 * ikisini `event_id` üzerinden TEKİLLEŞTİRİR.
 *
 * ⛔ ÇİFT SAYIM = ÇİFT CİRO. Tekilleştirme yalnız şu dizge birebir aynıysa çalışır:
 *     tema:   eventID = 'via-pur-' + String(no)      (no = başarı sayfası URL'sindeki `order`)
 *     sunucu: event_id = purchaseOlayKimligi(no)     (aynı `no`)
 *   `no`, ödeme yoluna göre FARKLI bir şeydir (ölçüldü, 22 Eki):
 *     · kart (Halköde · iyzico · PayTR) → callback'in yönlendirdiği `order=<draftId>`
 *       (Shopify taslak id'si / native numerik ref) — sipariş adı (#1032) DEĞİL;
 *     · havale · kapıda → tema `vmTesekkureGit`: `String(order_code||order_name).replace('#','')`.
 *   Bu dosya iki kuralı da tek yerde tutar; çağıran `no`yu kendisi uydurmaz.
 *
 * ⛔ JETON YOKSA SESSİZ NO-OP: istisna yok, sipariş akışı durmaz, kütüğe TEK satır
 *   "capi atlandı: jeton yok". Jeton koda gömülmez; değeri hiçbir loga yazılmaz.
 * ⛔ PII DÜZ METİN GİTMEZ, LOGA DÜŞMEZ: e-posta/telefon/ad/şehir SHA-256 (Meta'nın
 *   normalizasyonuyla) hash'lenir; log satırları yalnız event_id · durum · HTTP kodu taşır.
 * ⛔ ASLA FIRLATMAZ: her hata `{durum:'hata'}` döner; `arkaPlanda` sarmalayıcısı
 *   ödeme yanıtını hiç bekletmez.
 *
 * Bu dosya SAF çekirdektir: env / DB / Next bağımlılığı YOK (ayar ve fetch enjekte
 * edilir) — çivi `tests/meta-capi.test.ts` ağsız koşar. Ödeme akışına bağlantı
 * `capi-bagla.ts`'tedir.
 */
import { createHash } from 'node:crypto';

/** ViaMood Pixel — tema Web Pixel 3431923844'ün yayınladığı piksel. Sır DEĞİL. */
export const VIAMOOD_PIXEL_ID = '1355197119331444';
export const VARSAYILAN_GRAPH_SURUMU = 'v21.0';
/** Temanın eventID öneki — DEĞİŞİRSE tema da değişmeli (çivi ikisini birlikte okur). */
export const PURCHASE_OLAY_ONEKI = 'via-pur-';

export type CapiAyar = {
  /** Sistem kullanıcısı erişim jetonu. Boş/yok ⇒ NO-OP. */
  jeton?: string | null;
  pikselId?: string | null;
  /** Yalnız ayarda VARSA gönderilir (Events Manager → Test Events). */
  testOlayKodu?: string | null;
  graphSurumu?: string | null;
};

export type PurchaseGirdi = {
  /** Temanın `order` URL parametresiyle AYNI değer (bkz. dosya başı). */
  siparisNo: string | number;
  /** Ödenen toplam, TL. 0/geçersiz ⇒ olay gönderilmez (tema da göndermiyor). */
  deger: number | string;
  paraBirimi?: string;
  /** Saniye cinsinden UNIX zamanı; yoksa şimdi. */
  olayZamani?: number;
  eposta?: string | null;
  telefon?: string | null;
  ad?: string | null;
  soyad?: string | null;
  sehir?: string | null;
  postaKodu?: string | null;
  /** Müşterinin tarayıcısından geldiyse; PayTR gibi sunucu-sunucu çağrıda yok. */
  istemciIp?: string | null;
  tarayici?: string | null;
  kaynakUrl?: string | null;
  kalemler?: Array<{ id: string | number; adet: number; birimFiyat?: number | null }>;
};

export type CapiSonuc =
  | { durum: 'atlandi'; sebep: 'jeton-yok' | 'gecersiz-girdi'; eventId?: string }
  | { durum: 'gonderildi'; eventId: string; deneme: number; alinan?: number }
  | { durum: 'hata'; eventId?: string; deneme: number; httpKodu?: number; sebep: string };

export type CapiBagimlilik = {
  fetchFn?: typeof fetch;
  /** Kütük — yalnız PII'siz tek satırlar gelir. */
  kutuk?: (satir: string) => void;
  bekle?: (ms: number) => Promise<void>;
  /** En fazla deneme (ilk + yeniden). Varsayılan 3. */
  enCokDeneme?: number;
  zamanAsimiMs?: number;
  simdi?: () => number;
};

/** Temanın eventID'si ile BİREBİR: 'via-pur-' + String(no). */
export function purchaseOlayKimligi(siparisNo: string | number): string {
  return PURCHASE_OLAY_ONEKI + String(siparisNo);
}

/**
 * Havale/kapıda yolunda temanın `order` parametresi: `vmTesekkureGit` içindeki
 * `String(d.order_code || d.order_name || '').replace('#','')` — İLK '#' silinir.
 */
export function temaSiparisNo(orderCodeVeyaAd: string | number | null | undefined): string {
  return String(orderCodeVeyaAd || '').replace('#', '');
}

// ── Normalizasyon + hash (Meta "customer information parameters") ───────────────
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

export function epostaNormal(e?: string | null): string | null {
  const t = String(e ?? '').trim().toLowerCase();
  return t.includes('@') ? t : null;
}

/**
 * Telefon: yalnız rakam + ülke kodu. TR biçimleri: 05xx… (11 hane) → 905xx…,
 * 5xx… (10 hane) → 905xx…, 905xx… / +90… → olduğu gibi. Anlamsız kısa dizge ⇒ null.
 */
export function telefonNormal(t?: string | null): string | null {
  let d = String(t ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10 && d.startsWith('5')) d = '90' + d;
  return d.length >= 10 ? d : null;
}

/** Ad/soyad/şehir: TR küçük harf (İ→i), boşluk ve noktalama düşer. */
export function metinNormal(s?: string | null): string | null {
  const t = String(s ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[\s\p{P}\p{S}]/gu, '');
  return t || null;
}

function hashli(v: string | null): string[] | undefined {
  return v ? [sha256(v)] : undefined;
}

/**
 * Meta'ya giden olay gövdesi (jetonsuz). PII yalnız hash'li alanlarda bulunur;
 * düz e-posta/telefon/ad bu nesnenin HİÇBİR yerinde yer almaz (çivi bunu tarar).
 */
export function purchaseOlayi(g: PurchaseGirdi, simdi: () => number = Date.now) {
  const deger = Math.round(parseFloat(String(g.deger)) * 100) / 100;
  const no = String(g.siparisNo ?? '').trim();
  if (!no || !isFinite(deger) || deger <= 0) return null;

  const userData: Record<string, unknown> = {
    em: hashli(epostaNormal(g.eposta)),
    ph: hashli(telefonNormal(g.telefon)),
    fn: hashli(metinNormal(g.ad)),
    ln: hashli(metinNormal(g.soyad)),
    ct: hashli(metinNormal(g.sehir)),
    zp: hashli(metinNormal(g.postaKodu)),
    country: [sha256('tr')],
  };
  if (g.istemciIp) userData.client_ip_address = g.istemciIp;
  if (g.tarayici) userData.client_user_agent = g.tarayici;
  for (const k of Object.keys(userData)) if (userData[k] === undefined) delete userData[k];

  const kalemler = (g.kalemler ?? []).filter((k) => k && k.adet > 0 && String(k.id));
  const customData: Record<string, unknown> = {
    value: deger,
    currency: (g.paraBirimi || 'TRY').toUpperCase(),
    order_id: no, // tema da aynı alanı gönderiyor
  };
  if (kalemler.length) {
    customData.content_type = 'product';
    customData.content_ids = kalemler.map((k) => String(k.id));
    customData.contents = kalemler.map((k) => {
      const c: Record<string, unknown> = { id: String(k.id), quantity: k.adet };
      const f = Number(k.birimFiyat);
      if (isFinite(f) && f > 0) c.item_price = Math.round(f * 100) / 100;
      return c;
    });
  }

  const olay: Record<string, unknown> = {
    event_name: 'Purchase',
    event_time: g.olayZamani ?? Math.floor(simdi() / 1000),
    event_id: purchaseOlayKimligi(no),
    action_source: 'website',
    user_data: userData,
    custom_data: customData,
  };
  if (g.kaynakUrl) olay.event_source_url = g.kaynakUrl;
  return olay;
}

const varsayilanBekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const varsayilanKutuk = (s: string) => console.log(s);

/** Yeniden denemeye değer mi: ağ hatası, 429 ve 5xx evet; diğer 4xx hayır (aynı sonucu verir). */
function yenidenDenenir(httpKodu?: number): boolean {
  return httpKodu === undefined || httpKodu === 429 || httpKodu >= 500;
}

/**
 * Purchase'ı Meta'ya gönderir. ASLA fırlatmaz; jeton yoksa ağa HİÇ çıkmaz.
 * Jeton sorgu dizgesine değil GÖVDEYE konur → URL loglansa bile sızmaz.
 */
export async function purchaseGonder(
  g: PurchaseGirdi,
  ayar: CapiAyar,
  b: CapiBagimlilik = {},
): Promise<CapiSonuc> {
  const kutuk = b.kutuk ?? varsayilanKutuk;
  let eventId: string | undefined;
  try {
    eventId = g && g.siparisNo != null && String(g.siparisNo).trim()
      ? purchaseOlayKimligi(String(g.siparisNo).trim())
      : undefined;
    const jeton = String(ayar?.jeton ?? '').trim();
    if (!jeton) {
      kutuk(`[meta-capi] capi atlandı: jeton yok event_id=${eventId ?? '-'}`);
      return { durum: 'atlandi', sebep: 'jeton-yok', eventId };
    }
    const olay = purchaseOlayi(g, b.simdi);
    if (!olay) {
      kutuk(`[meta-capi] capi atlandı: geçersiz girdi (no/değer) event_id=${eventId ?? '-'}`);
      return { durum: 'atlandi', sebep: 'gecersiz-girdi', eventId };
    }

    const piksel = String(ayar.pikselId || VIAMOOD_PIXEL_ID).trim();
    const surum = String(ayar.graphSurumu || VARSAYILAN_GRAPH_SURUMU).trim();
    const url = `https://graph.facebook.com/${surum}/${encodeURIComponent(piksel)}/events`;
    const govde: Record<string, unknown> = { data: [olay], access_token: jeton };
    const test = String(ayar.testOlayKodu ?? '').trim();
    if (test) govde.test_event_code = test;
    const istekGovdesi = JSON.stringify(govde);

    const fetchFn = b.fetchFn ?? fetch;
    const bekle = b.bekle ?? varsayilanBekle;
    const enCok = Math.max(1, b.enCokDeneme ?? 3);
    const zamanAsimi = b.zamanAsimiMs ?? 8000;

    let son: CapiSonuc = { durum: 'hata', eventId, deneme: 0, sebep: 'denenmedi' };
    for (let deneme = 1; deneme <= enCok; deneme++) {
      let httpKodu: number | undefined;
      try {
        const ctl = new AbortController();
        const zamanlayici = setTimeout(() => ctl.abort(), zamanAsimi);
        let yanit: Response;
        try {
          yanit = await fetchFn(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: istekGovdesi,
            signal: ctl.signal,
          });
        } finally {
          clearTimeout(zamanlayici);
        }
        httpKodu = yanit.status;
        if (yanit.ok) {
          let alinan: number | undefined;
          try {
            const j = (await yanit.json()) as { events_received?: number };
            alinan = typeof j?.events_received === 'number' ? j.events_received : undefined;
          } catch {
            /* gövde okunamasa da 2xx başarıdır */
          }
          kutuk(`[meta-capi] gönderildi event_id=${eventId} deneme=${deneme} alinan=${alinan ?? '?'}${test ? ' test=1' : ''}`);
          return { durum: 'gonderildi', eventId: eventId!, deneme, alinan };
        }
        // Meta hata gövdesi (error.message/code) PII taşımaz ama yine de loga yalnız KOD yazılır.
        son = { durum: 'hata', eventId, deneme, httpKodu, sebep: `http-${httpKodu}` };
      } catch (e) {
        const ad = (e as { name?: string })?.name === 'AbortError' ? 'zaman-asimi' : 'ag-hatasi';
        son = { durum: 'hata', eventId, deneme, sebep: ad };
      }
      const devam = deneme < enCok && yenidenDenenir(httpKodu);
      kutuk(`[meta-capi] HATA event_id=${eventId} deneme=${deneme}/${enCok} sebep=${son.durum === 'hata' ? son.sebep : '?'}${devam ? ' → yeniden' : ' → bırakıldı'}`);
      if (!devam) break;
      await bekle(500 * 3 ** (deneme - 1)); // 0,5 s · 1,5 s
    }
    return son;
  } catch (e) {
    // Buraya düşmek bir PROGRAMLAMA hatasıdır; yine de sipariş akışına sızmaz.
    try {
      kutuk(`[meta-capi] HATA event_id=${eventId ?? '-'} beklenmeyen=${(e as Error)?.name ?? 'Error'}`);
    } catch {
      /* kütük de bozuksa sessiz */
    }
    return { durum: 'hata', eventId, deneme: 0, sebep: 'beklenmeyen' };
  }
}
