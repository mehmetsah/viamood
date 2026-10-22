/**
 * META CAPI · ÖDEME AKIŞINA BAĞLANTI — #994827.
 *
 * Saf çekirdek `capi.ts`'tedir; burası yalnız (1) ayarı env'den okur, (2) her ödeme
 * yolunun elindeki veriyi `PurchaseGirdi`ye çevirir, (3) gönderimi ARKA PLANA atar.
 *
 * TETİK NOKTALARI — yeni cron/kuyruk YOK, mevcut ödeme onayı akışları:
 *   · Halköde / iyzico / PayTR callback → Shopify taslağı `complete` 2xx döndüğünde
 *     (`taslaktanGirdi`, siparisNo = draftId — temanın `order` parametresi);
 *   · native kart → `completeNativeCardOrder` ödendi işaretinden sonra;
 *   · havale / kapıda → `/payment/{havale,cod}/create` sipariş açıldığında (tema
 *     başarı sayfasında bu yolda da Purchase atıyor; sunucu onunla eşleşmeli).
 * Shopify `orders/create` webhook'u BİLEREK seçilmedi: sipariş yükü taslak id'sini
 * taşımaz, yani kart yolunda temanın event_id'sini yeniden kuramaz → tekilleştirme kırılır.
 *
 * `arkaPlanda` SENKRON döner ve fırlatmaz: callback'in yönlendirme yanıtı Meta'yı beklemez.
 */
import { env } from '@/lib/env';
import { purchaseGonder, temaSiparisNo, type CapiAyar, type PurchaseGirdi } from './capi';

export function capiAyar(): CapiAyar {
  return {
    jeton: env.META_CAPI_TOKEN,
    pikselId: env.META_PIXEL_ID,
    testOlayKodu: env.META_CAPI_TEST_EVENT_CODE,
    graphSurumu: env.META_GRAPH_VERSION,
  };
}

/** Başarı sayfası — tema Purchase'ı burada atıyor; event_source_url olarak aynısı. */
function basariSayfasi(): string {
  return `${env.STOREFRONT_URL}/pages/siparis-alindi`;
}

/** Ateşle ve unut. Hiçbir koşulda fırlatmaz, çağıranı bekletmez. */
export function metaPurchaseArkaPlanda(girdi: PurchaseGirdi | null | undefined): void {
  try {
    if (!girdi) return;
    void purchaseGonder(girdi, capiAyar()).catch(() => {});
  } catch {
    /* env okunamadı vb. — sipariş akışına sızmaz */
  }
}

export type Istemci = { istemciIp?: string | null; tarayici?: string | null };

/** Müşterinin tarayıcısından gelen istekten IP + UA (yalnız Meta'ya; loglanmaz). */
export function istemciBilgisi(h: { get(ad: string): string | null } | null | undefined): Istemci {
  if (!h) return {};
  const ip = (h.get('x-forwarded-for') || '').split(',')[0]?.trim() || h.get('x-real-ip') || null;
  return { istemciIp: ip || null, tarayici: h.get('user-agent') || null };
}

type TaslakAdres = { first_name?: string | null; last_name?: string | null; phone?: string | null; city?: string | null; province?: string | null; zip?: string | null };
type TaslakYanit = {
  draft_order?: {
    email?: string | null;
    phone?: string | null;
    total_price?: string | number | null;
    currency?: string | null;
    customer?: { email?: string | null; phone?: string | null; first_name?: string | null; last_name?: string | null } | null;
    shipping_address?: TaslakAdres | null;
    billing_address?: TaslakAdres | null;
    line_items?: Array<{ variant_id?: number | string | null; quantity?: number; price?: string | number | null }> | null;
  } | null;
};

/** Shopify `draft_orders/{id}/complete.json` yanıtı → Purchase girdisi. */
export function taslaktanGirdi(yanit: unknown, draftId: string, istemci: Istemci = {}): PurchaseGirdi | null {
  const d = (yanit as TaslakYanit | null)?.draft_order;
  if (!d || !draftId) return null;
  const adr = d.shipping_address ?? d.billing_address ?? {};
  return {
    siparisNo: draftId,
    deger: d.total_price ?? 0,
    paraBirimi: d.currency || 'TRY',
    eposta: d.email || d.customer?.email,
    telefon: d.phone || adr.phone || d.customer?.phone,
    ad: adr.first_name || d.customer?.first_name,
    soyad: adr.last_name || d.customer?.last_name,
    sehir: adr.province || adr.city, // custom checkout: province = il, city = ilçe
    postaKodu: adr.zip,
    kalemler: (d.line_items ?? [])
      .filter((li) => li?.variant_id)
      .map((li) => ({ id: String(li.variant_id), adet: Number(li.quantity) || 0, birimFiyat: Number(li.price) })),
    kaynakUrl: basariSayfasi(),
    ...istemci,
  };
}

type Govde = {
  email?: string; customer_email?: string; phone?: string; first_name?: string; last_name?: string;
  province?: string; city?: string; zip?: string;
  line_items?: Array<{ variant_id: number | string; quantity: number; price?: number }>;
};

/** Havale/kapıda: istek gövdesi + oluşan sipariş → Purchase girdisi (no = temanın `kod`u). */
export function govdedenGirdi(
  body: Govde,
  created: { orderName: string; total: number },
  istemci: Istemci = {},
): PurchaseGirdi | null {
  const no = temaSiparisNo(created?.orderName);
  if (!no) return null;
  return {
    siparisNo: no,
    deger: created.total,
    paraBirimi: 'TRY',
    eposta: body.customer_email || body.email,
    telefon: body.phone,
    ad: body.first_name,
    soyad: body.last_name,
    sehir: body.province || body.city,
    postaKodu: body.zip,
    kalemler: (body.line_items ?? []).map((li) => ({ id: String(li.variant_id), adet: Number(li.quantity) || 0, birimFiyat: li.price })),
    kaynakUrl: basariSayfasi(),
    ...istemci,
  };
}

/**
 * Native kart: RDS satırı → Purchase girdisi (no = numerik ref = temanın `order`ı).
 * Kalem GÖNDERİLMEZ: `order_line_items.variant_id` iç UUID'dir, Meta kataloğundaki
 * Shopify varyant kimliği değil — yanlış content_ids göndermek eşleşmeyi bozar.
 */
export function nativeGirdi(o: {
  numericRef: string;
  totalCents: number | string | bigint | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}): PurchaseGirdi | null {
  if (!o?.numericRef) return null;
  const [ad, ...soyad] = String(o.name ?? '').trim().split(/\s+/);
  return {
    siparisNo: o.numericRef,
    deger: Number(o.totalCents) / 100,
    paraBirimi: 'TRY',
    eposta: o.email,
    telefon: o.phone,
    ad: ad || null,
    soyad: soyad.join(' ') || null,
    kaynakUrl: basariSayfasi(),
  };
}
