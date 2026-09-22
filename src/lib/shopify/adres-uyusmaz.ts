/**
 * Sipariş oluştuktan sonra Shopify'ın İLİ değiştirip değiştirmediğini denetler.
 *
 * Neden (#1164 / #1169): Shopify, adresteki posta kodundan ili yeniden yazıyor.
 * `adres.ts` artık uyumsuz posta kodunu göndermiyor; bu dosya ise gönderdiğimiz
 * il kodu ile Shopify'ın kaydettiği il kodunu karşılaştırır ve farklıysa
 * loglar + siparişe `adres-uyusmaz` etiketi ekler ki operasyon Shopify listesinde
 * görsün. Yalnız YENİ siparişlerde, oluşturma akışı içinde çağrılır.
 *
 * Kart yollarında (PayTR/Halköde/İyzico) il değişimi taslak oluşurken değil,
 * taslak TAMAMLANIRKEN oluyor (ölçüldü 21 Eyl: #1165 taslakta il kodu yok,
 * posta kodu 34080 → siparişte Istanbul/TR-34; #1168 posta kodu boş → siparişte il
 * tamamen düşmüş). Bu yüzden kart yolları `taslakTamamlanincaIlDenetle` ile
 * geri dönüşte (callback) denetlenir.
 *
 * Hiçbir işlev hata FIRLATMAZ: ödeme/sipariş akışını bu denetim yüzünden
 * durdurmak satış kaybı olur.
 */
import { shopifyGraphQL, shopifyRest } from './client';
import { provinceCode, provinceName } from './tr-provinces';

export const ADRES_UYUSMAZ_ETIKETI = 'adres-uyusmaz';

/** Gönderilen il kodu, Shopify'ın döndürdüğünden farklı mı? Biz kod göndermediysek karşılaştırılmaz. */
export function ilKoduUyusmazMi(
  gonderilen: string | null | undefined,
  donen: string | null | undefined,
): boolean {
  const g = (gonderilen ?? '').trim().toUpperCase();
  if (!g) return false;
  return (donen ?? '').trim().toUpperCase() !== g;
}

const TAGS_ADD = `mutation adresUyusmazEtiketi($id: ID!, $tags: [String!]!) {
  tagsAdd(id: $id, tags: $tags) { userErrors { field message } }
}`;

export interface IlDenetimGirdisi {
  siparisId: number | string; // Shopify numerik sipariş id
  siparisAdi?: string | null;
  gonderilenIlKodu: string | null;
  donenIlKodu: string | null | undefined;
  donenIl?: string | null;
  kaynak: string; // 'cod' | 'havale' | 'paytr' | 'halkode' | 'iyzico'
}

/**
 * Uyuşmazlık varsa loglar ve siparişe `adres-uyusmaz` etiketi ekler.
 * @returns uyuşmazlık bulundu mu
 */
export async function ilKoduUyusmazsaEtiketle(p: IlDenetimGirdisi): Promise<boolean> {
  if (!ilKoduUyusmazMi(p.gonderilenIlKodu, p.donenIlKodu)) return false;
  console.warn('[adres-uyusmaz] Shopify siparişin ilini değiştirdi', {
    siparis: p.siparisAdi ?? p.siparisId,
    kaynak: p.kaynak,
    gonderilen: p.gonderilenIlKodu,
    donen: p.donenIlKodu ?? null,
    donenIl: p.donenIl ?? null,
  });
  try {
    // tagsAdd: mevcut etiketlerin ÜSTÜNE ekler (REST PUT tüm listeyi ezerdi)
    const r = await shopifyGraphQL<{ tagsAdd?: { userErrors?: Array<{ message: string }> } }>(TAGS_ADD, {
      id: `gid://shopify/Order/${p.siparisId}`,
      tags: [ADRES_UYUSMAZ_ETIKETI],
    });
    const hatalar = r?.tagsAdd?.userErrors ?? [];
    if (hatalar.length) {
      console.error('[adres-uyusmaz] etiket eklenemedi', { siparis: p.siparisAdi ?? p.siparisId, hatalar });
    }
  } catch (e) {
    console.error('[adres-uyusmaz] etiket eklenemedi', {
      siparis: p.siparisAdi ?? p.siparisId,
      e: e instanceof Error ? e.message : String(e),
    });
  }
  return true;
}

interface TaslakAdresi {
  province?: string | null;
  province_code?: string | null;
}

/**
 * `draft_orders/{id}/complete.json` yanıtından tamamlanan siparişi bulur, Shopify'ın
 * kaydettiği il kodunu okur ve gönderdiğimizle karşılaştırır.
 *
 * "Gönderdiğimiz" = taslakta DURAN il ADI üzerinden bizim kod tablomuz. Taslağın
 * kendi province_code'u kullanılmaz: Shopify 'İstanbul'/'İzmir' (noktalı İ) adını
 * tanımadığı için taslakta kodu boş bırakıyor (ölçüldü: #D883, #D891) — o alanla
 * karşılaştırmak her İstanbul siparişini sahte "uyuşmaz" yapardı.
 */
export async function taslakTamamlanincaIlDenetle(yanit: unknown, kaynak: string): Promise<void> {
  try {
    const d = (yanit as { draft_order?: { order_id?: number | null; shipping_address?: TaslakAdresi | null } } | null)
      ?.draft_order;
    const siparisId = d?.order_id;
    if (!siparisId) return;
    const taslakIl = d?.shipping_address?.province ?? '';
    const gonderilen = provinceCode(provinceName(taslakIl)) ?? d?.shipping_address?.province_code ?? null;
    if (!gonderilen) return;
    const j = await shopifyRest<{
      order?: { name?: string; shipping_address?: { province?: string | null; province_code?: string | null } | null };
    }>(`/orders/${siparisId}.json?fields=name,shipping_address`);
    await ilKoduUyusmazsaEtiketle({
      siparisId,
      siparisAdi: j?.order?.name ?? null,
      gonderilenIlKodu: gonderilen,
      donenIlKodu: j?.order?.shipping_address?.province_code ?? null,
      donenIl: j?.order?.shipping_address?.province ?? null,
      kaynak,
    });
  } catch (e) {
    console.error('[adres-uyusmaz] taslak sonrası il denetimi yapılamadı', {
      kaynak,
      e: e instanceof Error ? e.message : String(e),
    });
  }
}
