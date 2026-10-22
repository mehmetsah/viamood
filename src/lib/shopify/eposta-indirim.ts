/**
 * E-POSTA AKIŞI KUPONUNU SHOPIFY'DA AÇAR (#994816).
 *
 * Yunus 21 Eki 2026 (birebir): «Tüm kodlar kişiye özel ve tek kullanımlık
 * olmalı … Kod kampanyalarıyla çakışmayı Shopify "combinations" ayarından
 * kapatın». 16 Eki'deki "HOSGELDIN10'u gönder" notu bu tekrarlanan spec'te YOK;
 * gruba 21 Eki 10:21 ve 22 Eki 13:37'de kişiye özel kod taahhüdü verildi.
 *
 * NEDEN SHOPIFY'DA DA AÇILIYOR: ödeme uçlarının hepsi (`discount-resolve.ts`)
 * kodu Shopify `discount_codes/lookup` ile çözüyor; Shopify'da olmayan kod
 * ödeme sayfasında "geçersiz" düşer. Yani kod Shopify'da yoksa müşteriye
 * kullanamayacağı bir kod göndermiş oluruz.
 *
 * KURALLAR BU DOSYADA SABİT, tek yerde:
 *  · usageLimit 1 + appliesOncePerCustomer → tek kullanımlık
 *  · endsAt = defterdeki bitiş (hoş geldin 7 gün · terk 48 saat)
 *  · combinesWith ürün/sipariş indirimi KAPALI → kampanyayla üst üste binmez.
 *    Kargo indirimi AÇIK bırakıldı: ücretsiz kargo bir "kampanya" değil, kodu
 *    kullanan müşterinin kargo hakkını sessizce düşürmek spec'te yok.
 *  · müşteri seçimi "all": kişiye kilit BİZİM tarafta (`eposta-kupon-odeme.ts`,
 *    e-posta eşleşmesi). Shopify'da müşteriye kilitli kod `discount-resolve`
 *    tarafından fail-closed reddedilir (customer_selection !== 'all').
 *
 * ⚠ 300 TL TAVANI SHOPIFY'DA YOK (yüzde indiriminde tavan alanı yoktur).
 *   Tavan bizim ödeme uçlarımızda uygulanır; Shopify'ın KENDİ checkout'u
 *   kullanılırsa tavan uygulanamaz — raporda açık risk olarak yazılı.
 */
import { shopifyGraphQL } from './client';

export type ShopifyKuponSonuc = { ok: true; id: string } | { ok: false; hata: string };
export type ShopifyKuponAcici = (k: {
  kod: string;
  akis: string;
  yuzde: number;
  baslangic: Date;
  bitis: Date;
}) => Promise<ShopifyKuponSonuc>;

/** SAF — mutation değişkenleri. Çivi bu nesneyi doğrudan ölçer. */
export function indirimGirdisi(k: Parameters<ShopifyKuponAcici>[0]) {
  return {
    title: `ViaMood e-posta · ${k.akis} · ${k.kod}`,
    code: k.kod,
    startsAt: k.baslangic.toISOString(),
    endsAt: k.bitis.toISOString(),
    customerSelection: { all: true },
    customerGets: { value: { percentage: k.yuzde / 100 }, items: { all: true } },
    usageLimit: 1,
    appliesOncePerCustomer: true,
    combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true },
  };
}

const MUTASYON = `mutation EpostaKupon($d: DiscountCodeBasicInput!) {
  discountCodeBasicCreate(basicCodeDiscount: $d) {
    codeDiscountNode { id }
    userErrors { field code message }
  }
}`;

type Yanit = {
  discountCodeBasicCreate?: {
    codeDiscountNode?: { id?: string } | null;
    userErrors?: Array<{ field?: string[] | null; code?: string | null; message?: string }>;
  };
};

/**
 * Kodu Shopify'da açar. Hata FIRLATMAZ — sonuç döner; çağıran (kuponAc)
 * başarısızlıkta deftere satır YAZMAZ, böylece 60 gün freni boşa yanmaz ve
 * müşteriye kullanılamayan kod gitmez.
 */
export const shopifyKuponAc: ShopifyKuponAcici = async (k) => {
  try {
    const d = await shopifyGraphQL<Yanit>(MUTASYON, { d: indirimGirdisi(k) });
    const r = d?.discountCodeBasicCreate;
    const hatalar = r?.userErrors ?? [];
    if (hatalar.length) return { ok: false, hata: hatalar.map((h) => h.message ?? h.code ?? '?').join('; ').slice(0, 300) };
    const id = r?.codeDiscountNode?.id;
    if (!id) return { ok: false, hata: 'Shopify kod kimliği dönmedi' };
    return { ok: true, id };
  } catch (e) {
    // 403 = uygulamada write_discounts izni yok. Mesaj gövdesi defterde görünür.
    const m = e instanceof Error ? e.message : String(e);
    const govde = (e as { body?: unknown })?.body;
    return { ok: false, hata: `${m}${govde ? ' ' + JSON.stringify(govde) : ''}`.slice(0, 300) };
  }
};

/** Yetki ölçümü (yalnız okuma) — kuru koşu raporunda "açılmaya hazır mı" sorusu. */
export async function indirimYazmaIzniVarMi(): Promise<boolean | null> {
  try {
    const d = await shopifyGraphQL<{ currentAppInstallation?: { accessScopes?: Array<{ handle: string }> } }>(
      '{ currentAppInstallation { accessScopes { handle } } }',
    );
    const izinler = (d?.currentAppInstallation?.accessScopes ?? []).map((s) => s.handle);
    return izinler.includes('write_discounts');
  } catch {
    return null; // ölçülemedi — "yok" demek değil
  }
}
