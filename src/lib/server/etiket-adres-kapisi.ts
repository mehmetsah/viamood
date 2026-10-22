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
import { ilIlceUyumu, trKatla } from '@/lib/tr-addresses/il-ilce-uyum';
import { provinceName } from '@/lib/shopify/tr-provinces';

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

/**
 * Siparişin KENDİ notundan müşterinin ödeme formunda seçtiği il/ilçe.
 *
 * Bütün sipariş kurma yolları (kapıda/havale, PayTR, Halköde, İyzico, native)
 * notun ilk satırına `📍 Ad Soyad · <il>/<ilçe>` yazar; il ad ya da 'TR-XX'
 * olabilir. Ad Soyad içinde " · " geçme ihtimaline karşı SON ayraç alınır.
 * Biçim tutmuyorsa null — tahmin yok.
 */
export function nottanIlIlce(not: string | null | undefined): { il: string; ilce: string } | null {
  const satir = (not ?? '').split('\n').find((s) => s.trim().startsWith('📍'));
  if (!satir) return null;
  const ayrac = satir.lastIndexOf(' · ');
  if (ayrac < 0) return null;
  const kuyruk = satir.slice(ayrac + 3).trim();
  const bolu = kuyruk.indexOf('/');
  if (bolu <= 0) return null;
  const il = provinceName(kuyruk.slice(0, bolu).trim());
  const ilce = kuyruk.slice(bolu + 1).trim();
  return il && ilce ? { il, ilce } : null;
}

const IL_EKSIK_HATASI =
  'Teslimat adresinde İL eksik — etiket kesilmedi (ilçe adı il olarak basılmasın diye). Shopify siparişinde il alanını doldurun.';

/**
 * İL BOŞ — #994827 / sipariş #1214.
 *
 * ÖLÇÜLEN ARIZA (22 Eki 2026, prod): kart yollarında (Halköde/PayTR/İyzico)
 * Shopify taslak tamamlanırken posta kodu boşsa İLİ DÜŞÜRÜYOR (21 Eyl #1168'de
 * görülmüş, `adres-uyusmaz.ts` yalnız etiketliyor). #993105 il boşken etiketi
 * doğru biçimde durduruyor, ama bu kapı il-yok'ta Shopify'ı hiç yeniden
 * okumadığı için "Shopify'da ili doldurun" mesajı ÇIKMAZ bir yoldu: son 30
 * günde ödenmiş 8 Halköde siparişinin hiçbirine etiket kesilmedi, beşi sistem
 * dışında elle gönderildi ve hiçbiri Mikro'ya düşmedi.
 *
 * Sıra: (1) operasyon Shopify'da ili doldurduysa güncel adres; (2) siparişin
 * kendi notundaki müşteri seçimi — YALNIZ notun ilçesi teslimat ilçesiyle
 * birebir aynıysa ve il/ilçe çifti geçerliyse; (3) yoksa DUR + olay kaydı.
 * ⛔ İlçeden il TÜRETİLMEZ (#993105: "Yenişehir" üç ilde var) — not müşterinin
 *    kendi seçimidir, tahmin değil.
 */
async function ilYokKapisi(
  p: { orderId: string; vendorId: string; shopifyOrderId: string | null; ship: Adres; not?: string | null },
  bag: EtiketKapisiBagimliliklari,
): Promise<EtiketKapisiSonucu> {
  if (p.shopifyOrderId) {
    try {
      const taze = await bag.guncelAdresOku(p.shopifyOrderId);
      if (taze && ilIlceUyumu(taze.district, taze.city).durum === 'uyumlu') {
        await bag.adresiKaydet(p.orderId, taze);
        console.log('[fulfillment] il Shopify tarafında doldurulmuş — güncel adresle devam', {
          orderId: p.orderId,
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

  const n = nottanIlIlce(p.not);
  if (n && trKatla(n.ilce) === trKatla(p.ship.city) && ilIlceUyumu(n.il, p.ship.city).durum === 'uyumlu') {
    const yeni: Adres = { ...p.ship, district: n.il };
    try {
      await bag.adresiKaydet(p.orderId, yeni);
    } catch (e) {
      // Etiket doğru ille kesilir; yalnız DB kopyası eski kalır — logla, durma.
      console.error('[fulfillment] notla kurulan il DB kaydına yazılamadı', { orderId: p.orderId, e: String(e) });
    }
    console.log('[fulfillment] il siparişin kendi notundan kuruldu (müşterinin ödeme formundaki seçimi)', {
      orderId: p.orderId,
      yeni: `${n.il}/${p.ship.city}`,
    });
    return { ok: true, ship: yeni, tazelendi: true };
  }

  console.error('[fulfillment] etiket kesilmedi — İL yok (Shopify ve sipariş notu il vermedi)', {
    orderId: p.orderId,
    vendorId: p.vendorId,
    ilce: p.ship.city ?? null,
  });
  try {
    await bag.olayYaz(p.orderId, p.vendorId, { sebep: 'il-yok', ilce: p.ship.city ?? null, hata: IL_EKSIK_HATASI });
  } catch (e) {
    console.error('[fulfillment] etiket_engellendi olayı yazılamadı', { orderId: p.orderId, e: String(e) });
  }
  return { ok: false, error: IL_EKSIK_HATASI };
}

export async function etiketAdresKapisi(
  p: { orderId: string; vendorId: string; shopifyOrderId: string | null; ship: Adres; not?: string | null },
  bag: EtiketKapisiBagimliliklari = varsayilanBagimliliklar,
): Promise<EtiketKapisiSonucu> {
  // TERS ADLANDIRMA: ship.district = İL, ship.city = İLÇE
  const uyum = ilIlceUyumu(p.ship.district, p.ship.city);
  if (uyum.durum === 'uyumlu') return { ok: true, ship: p.ship, tazelendi: false };
  if (uyum.durum === 'dogrulanamadi' && uyum.sebep === 'il-yok') return ilYokKapisi(p, bag);
  if (uyum.durum === 'dogrulanamadi') {
    // İl tanınmıyor / ilçe boş: bugünkü davranış sürer (ilçe boşu
    // fulfillment-service kendi kapısında durduruyor).
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
