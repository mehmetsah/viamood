/**
 * Kargo etiketi kesilmeden önceki il-ilçe kapısı.
 *
 * Neden (#1164 / #1169): Shopify ili posta kodundan yeniden yazınca sipariş
 * "Ankara / Erbaa" gibi imkânsız bir çiftle kaydediliyor ve etiket yanlış ile
 * kesiliyordu. İlçe, kayıtlı ilin listesinde yoksa etiket KESİLMEZ ve
 * "il-ilçe uyumsuz: <il>/<ilçe>" hatası döner.
 *
 * Operasyonun düzeltme yolu GERÇEKTEN çalışsın diye: DB'deki adres, sipariş
 * alındığı andaki kopyadır ve `orders/updated` webhook'u adresi GÜNCELLEMİYOR
 * (yalnız durum alanlarını yazıyor). Bu yüzden çift uyumsuzsa Shopify'daki GÜNCEL
 * adres bir kez okunur; operasyon Shopify'da düzelttiyse ve yeni çift uyumluysa
 * DB'ye yazılıp etiket onunla kesilir. Aksi hâlde "Shopify'da düzeltin" mesajı
 * hiçbir zaman işe yaramayan bir yola işaret ederdi.
 *
 * Hata, operasyonun baktığı üç yere düşer: dönen hata metni (tedarikçi panelindeki
 * "Etiket oluştur" düğmesi bunu gösterir), sipariş "Olay Kaydı" (`etiket_engellendi`)
 * ve auto-fulfill günlüğü (`[auto-fulfill] etiket HATA`).
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orderEvents, orders } from '@/db/schema';
import { shopifyRest } from '@/lib/shopify/client';
import { teslimatAdresiKaydi, type ShopifyTeslimatAdresi, type TeslimatAdresiKaydi } from '@/lib/shopify/teslimat-adresi';
import { ilIlceUyumu } from '@/lib/tr-addresses/il-ilce-uyum';

type Adres = Record<string, string | undefined>;

export type EtiketKapisiSonucu =
  | { ok: true; ship: Adres; tazelendi: boolean }
  | { ok: false; error: string };

export interface EtiketKapisiBagimliliklari {
  /** Shopify'daki güncel teslimat adresi (DB biçiminde); okunamazsa null */
  guncelAdresOku: (shopifyOrderId: string) => Promise<TeslimatAdresiKaydi | null>;
  adresiKaydet: (orderId: string, adres: TeslimatAdresiKaydi) => Promise<void>;
  olayYaz: (orderId: string, vendorId: string, payload: Record<string, unknown>) => Promise<void>;
}

export const varsayilanBagimliliklar: EtiketKapisiBagimliliklari = {
  async guncelAdresOku(shopifyOrderId) {
    const j = await shopifyRest<{ order?: { shipping_address?: ShopifyTeslimatAdresi | null } }>(
      `/orders/${shopifyOrderId}.json?fields=shipping_address`,
    );
    return teslimatAdresiKaydi(j?.order?.shipping_address);
  },
  async adresiKaydet(orderId, adres) {
    await db.update(orders).set({ shippingAddress: adres, updatedAt: new Date() }).where(eq(orders.id, orderId));
  },
  async olayYaz(orderId, vendorId, payload) {
    await db.insert(orderEvents).values({
      orderId,
      eventType: 'etiket_engellendi',
      actorType: 'system',
      actorId: 'il-ilce-uyumsuz',
      payload: { vendorId, ...payload },
    });
  },
};

export async function etiketAdresKapisi(
  p: { orderId: string; vendorId: string; shopifyOrderId: string | null; ship: Adres },
  bag: EtiketKapisiBagimliliklari = varsayilanBagimliliklar,
): Promise<EtiketKapisiSonucu> {
  // TERS ADLANDIRMA: ship.district = İL, ship.city = İLÇE
  const uyum = ilIlceUyumu(p.ship.district, p.ship.city);
  if (uyum.durum === 'uyumlu') return { ok: true, ship: p.ship, tazelendi: false };
  if (uyum.durum === 'dogrulanamadi') {
    // İl boş/tanınmıyor: bugünkü davranış sürer. Son 60 günde etiketi kesilen 108
    // siparişin 51'i bu hâlde (Shopify'da il boş, eski PayTR) — durdurmak doğru
    // etiketleri durdurmak olurdu.
    if (uyum.sebep !== 'ilce-yok') {
      console.warn('[fulfillment] il-ilçe doğrulanamadı, etiket kesiliyor', {
        orderId: p.orderId,
        sebep: uyum.sebep,
        il: p.ship.district ?? null,
        ilce: p.ship.city ?? null,
      });
    }
    return { ok: true, ship: p.ship, tazelendi: false };
  }

  // Uyumsuz. Operasyon Shopify'da düzelttiyse güncel adresi al.
  if (p.shopifyOrderId) {
    try {
      const taze = await bag.guncelAdresOku(p.shopifyOrderId);
      if (taze && ilIlceUyumu(taze.district, taze.city).durum === 'uyumlu') {
        await bag.adresiKaydet(p.orderId, taze);
        console.log('[fulfillment] il-ilçe Shopify tarafında düzeltilmiş — güncel adresle devam', {
          orderId: p.orderId,
          eski: `${uyum.il}/${uyum.ilce}`,
          yeni: `${taze.district}/${taze.city}`,
        });
        return { ok: true, ship: taze as Adres, tazelendi: true };
      }
    } catch (e) {
      console.error('[fulfillment] Shopify güncel adres okunamadı', {
        orderId: p.orderId,
        e: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const error =
    `il-ilçe uyumsuz: ${uyum.il}/${uyum.ilce} — ilçe bu ilin listesinde yok, etiket kesilmedi. ` +
    `Shopify siparişinde il/ilçeyi düzeltip etiketi yeniden deneyin.`;
  console.error('[fulfillment] etiket kesilmedi — il-ilçe uyumsuz', {
    orderId: p.orderId,
    vendorId: p.vendorId,
    il: uyum.il,
    ilce: uyum.ilce,
  });
  try {
    await bag.olayYaz(p.orderId, p.vendorId, { sebep: 'il-ilce-uyumsuz', il: uyum.il, ilce: uyum.ilce, hata: error });
  } catch (e) {
    console.error('[fulfillment] etiket_engellendi olayı yazılamadı', { orderId: p.orderId, e: String(e) });
  }
  return { ok: false, error };
}
