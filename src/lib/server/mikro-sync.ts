/**
 * Shopify order → Mikro V17 pipeline.
 *
 * Akış:
 *   1. Order DB'den + line_items + variant'ları (KDV, ağırlık) çek
 *   2. Cari kodu üret (counter +1) — DB'de mikro_sequences.cari_kodu_next
 *   3. cariKayit (müşteri) — fail olursa skip but devam edebilirsin (Yunus'un onayı)
 *   4. siparisEkle (sipariş + Satirlar)
 *   5. siparisOnayla (Mikro user 1 ile)
 *   6. orders.mikro_sync_status güncelle (her adımda audit)
 *
 * Idempotent: aynı order için tekrar çağrılırsa mevcut mikro_cari_kodu'yu kullanır
 * ve sadece eksik adımları tamamlar.
 *
 * Fire-and-forget: webhook handler 200 dönüşünden sonra paralel çalışır.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  mikroSequences,
  orderLineItems,
  orders,
  productVariants,
} from '@/db/schema';
import { logAudit } from '@/lib/audit/logger';
import { env } from '@/lib/env';
import { cariKayit, siparisEkle, siparisOnayla } from '@/lib/mikro/operations';
import type {
  MikroCariDto,
  MikroEvrak,
  MikroHareket,
} from '@/lib/mikro/types';

interface SyncOk {
  ok: true;
  orderId: string;
  cariKodu: string;
  evrakSeri: string;
  evrakSira: number;
  status: 'approved' | 'order_added' | 'customer_created';
}
interface SyncErr {
  ok: false;
  orderId: string;
  step: 'cari' | 'siparis' | 'onay' | 'lookup';
  error: string;
}
export type SyncResult = SyncOk | SyncErr;

const CARI_SEQ_KEY = 'cari_kodu_next';

/** Atomic next sequence — concurrent push'larda da güvenli (UPSERT + returning). */
async function nextCariSequence(): Promise<number> {
  // PostgreSQL ON CONFLICT ile atomic increment
  const res = await db
    .insert(mikroSequences)
    .values({
      key: CARI_SEQ_KEY,
      value: env.MIKRO_CARI_SEED + 1,
    })
    .onConflictDoUpdate({
      target: mikroSequences.key,
      set: { value: sql`${mikroSequences.value} + 1`, updatedAt: new Date() },
    })
    .returning({ value: mikroSequences.value });
  const next = res[0]?.value;
  if (next == null) throw new Error('Cari sequence alınamadı');
  return next;
}

function shippingTeslimTuruKodu(carrier: string | null | undefined): string {
  if (!carrier) return 'PTT';
  const c = carrier.toUpperCase();
  if (c.includes('PTT')) return 'PTT';
  if (c.includes('ARAS')) return 'ARAS';
  if (c.includes('MNG')) return 'MNG';
  if (c.includes('YURT')) return 'YURTICI';
  if (c.includes('SURAT') || c.includes('SÜRAT')) return 'SURAT';
  return 'PTT';
}

interface ShippingAddr {
  name?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
}

function splitName(full: string | null | undefined): { soyad: string; ad: string } {
  if (!full) return { soyad: '-', ad: '.' };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { soyad: parts[0]!, ad: '.' };
  const ad = parts.pop()!;
  return { soyad: parts.join(' '), ad: ad || '.' };
}

/** Kargo bilgisi — fulfillment sonrası push'ta evraka işlenir
 *  (el terminali sipariş kağıdını kargo etiketiyle birlikte bassın diye). */
export interface MikroKargoBilgi {
  courier?: string | null;
  trackingNumber?: string | null;
  barcode?: string | null;
}

/** Idempotent sync — orderId için Mikro pipeline'ını çalıştırır.
 *  kargo verilirse takip no evraka yazılır (BelgeNo + Aciklama4) ve TeslimTuruKodu gerçek kurye olur. */
export async function syncOrderToMikro(orderId: string, kargo?: MikroKargoBilgi): Promise<SyncResult> {
  // 1. Order çek
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) {
    return { ok: false, orderId, step: 'lookup', error: 'Order bulunamadı' };
  }

  // Zaten tamamlanmışsa skip
  if (order.mikroSyncStatus === 'approved') {
    return {
      ok: true,
      orderId,
      cariKodu: order.mikroCariKodu ?? '',
      evrakSeri: order.mikroEvrakSeri ?? '',
      evrakSira: order.mikroEvrakSira ?? 1,
      status: 'approved',
    };
  }
  if (order.mikroSyncStatus === 'skipped') {
    return {
      ok: false,
      orderId,
      step: 'lookup',
      error: 'Order Mikro sync için skip işaretli',
    };
  }

  // 2. Line items + variant detayları
  const lineItems = await db
    .select({
      id: orderLineItems.id,
      title: orderLineItems.title,
      sku: orderLineItems.sku,
      quantity: orderLineItems.quantity,
      unitPriceCents: orderLineItems.unitPriceCents,
      discountCents: orderLineItems.discountCents,
      variantSku: productVariants.sku,
      variantBarcode: productVariants.barcode,
      variantIsTaxable: productVariants.isTaxable,
    })
    .from(orderLineItems)
    .leftJoin(productVariants, eq(productVariants.id, orderLineItems.variantId))
    .where(eq(orderLineItems.orderId, orderId));

  if (lineItems.length === 0) {
    return { ok: false, orderId, step: 'lookup', error: 'Sipariş satırı yok' };
  }

  // 3. Cari oluştur (zaten varsa skip)
  let cariKodu = order.mikroCariKodu;
  if (!cariKodu) {
    const seq = await nextCariSequence();
    cariKodu = `${env.MIKRO_CARI_PREFIX}${seq}`;

    const ship = (order.shippingAddress ?? {}) as ShippingAddr;
    const { soyad, ad } = splitName(order.customerName);

    const cariDto: MikroCariDto = {
      UnvaniSoyadi: soyad || '-',
      UnvaniAdi: ad || '.',
      Kodu: cariKodu,
      EpostaAdresi: order.customerEmail ?? '',
      CepTelefonu: (order.customerPhone ?? '').replace(/[^\d+]/g, '').slice(0, 20),
      Telefon1: '',
      Telefon2: '0',
      VergiDaire: '',
      VergiNo: '11111111111',
      WebAdresi: '',
      DovizTip1: 'TL',
      DovizTip2: '',
      EFatura: false,
      VergiMukellefi: false,
      Adres1: {
        Adres: [ship.address1, ship.address2].filter(Boolean).join(' '),
        Ulke: ship.country ?? 'TURKEY',
        Sehir: ship.city ?? '',
        Kasaba: ship.district ?? '',
        PostaKodu: ship.postalCode ?? '',
      },
      FaturaAdresi: {
        Ulke: ship.country ?? 'TURKEY',
        Sehir: ship.city ?? '',
        Kasaba: ship.district ?? '',
        PostaKodu: ship.postalCode ?? '',
      },
      SevkAdresi: {
        Ulke: ship.country ?? 'TURKEY',
        Sehir: ship.city ?? '',
        Kasaba: ship.district ?? '',
        PostaKodu: ship.postalCode ?? '',
      },
    };

    const cariRes = await cariKayit(cariDto);
    if (!cariRes.ok) {
      await db
        .update(orders)
        .set({
          mikroSyncStatus: 'failed',
          mikroError: `cariKayit: ${cariRes.error}`,
          mikroCariKodu: cariKodu, // boş cari açma — Yunus'un kuralı: sipariş hata verse bile devam et
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
      // Yunus'un kuralı: cari hata verirse de devam, sipariş ekle dene
      // ama dönüş için status update et — alttaki step yine de çalışsın
    }

    await db
      .update(orders)
      .set({
        mikroCariKodu: cariKodu,
        mikroSyncStatus: cariRes.ok ? 'customer_created' : 'failed',
        mikroError: cariRes.ok ? null : `cariKayit: ${cariRes.error}`,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  }

  // 4. Sipariş ekle
  const ship = (order.shippingAddress ?? {}) as ShippingAddr;
  const evrakSeri = order.mikroEvrakSeri ?? order.shopifyOrderName ?? order.orderNumber ?? '';
  const evrakSira = order.mikroEvrakSira ?? 1;

  // SKU normalize + Mikro stok kodu üret (Yunus kuralı: VIA prefix)
  // Eğer satırlardan birinde SKU yoksa Mikro reddedeceğinden erken fail edelim
  const missingSkuLines = lineItems.filter((li) => !(li.variantSku ?? li.sku));
  if (missingSkuLines.length > 0) {
    const titles = missingSkuLines.map((li) => li.title).join(', ');
    const err = `SKU eksik satırlar: ${titles}`;
    await db
      .update(orders)
      .set({
        mikroSyncStatus: 'failed',
        mikroError: err,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    return { ok: false, orderId, step: 'siparis', error: err };
  }

  const satirlar: MikroHareket[] = lineItems.map((li) => {
    const unitPriceTl = Number(li.unitPriceCents) / 100;
    const discountTl = Number(li.discountCents) / 100;
    const rawSku = String(li.variantSku ?? li.sku ?? '').trim();
    // Yunus: ara depoya sevkiyat için VIA prefix. Zaten VIA ile başlıyorsa tekrar ekleme.
    const stokKodu = rawSku.toUpperCase().startsWith(env.MIKRO_STOK_PREFIX.toUpperCase())
      ? rawSku
      : `${env.MIKRO_STOK_PREFIX}${rawSku}`;
    return {
      Cinsi: 0, // Stok
      StokKodu: stokKodu,
      Barkodu: li.variantBarcode ?? '',
      KDV: li.variantIsTaxable === false ? 0 : 20,
      Miktar: li.quantity,
      Fiyat: unitPriceTl,
      Iskonto1: discountTl > 0 ? discountTl : 0,
      Aciklama: li.title.slice(0, 200),
      EntegrasyonID: li.id,
    };
  });

  const placedAtIso = order.placedAt.toISOString().slice(0, 19);

  // Kargo takip bilgisi (fulfillment sonrası push'ta dolu gelir)
  const takipNo = kargo?.trackingNumber ?? kargo?.barcode ?? null;
  const kargoBarkod = kargo?.barcode && kargo.barcode !== takipNo ? kargo.barcode : null;

  const evrak: MikroEvrak = {
    Tarih: placedAtIso,
    TeslimTarihi: placedAtIso,
    TeslimTuruKodu: shippingTeslimTuruKodu(kargo?.courier ?? null), // gerçek kurye (yoksa PTT default)
    SrmMerkezKodu: env.MIKRO_SRM_MERKEZ,
    DepoNo: env.MIKRO_DEPO_NO,
    OdemePlaniNo: env.MIKRO_ODEME_PLANI_NO,
    ProjeKodu: env.MIKRO_PROJE_KODU,
    EvrakSeri: evrakSeri,
    EvrakSira: evrakSira,
    ...(takipNo ? { BelgeNo: takipNo.slice(0, 50) } : {}),
    CariHesapKodu: cariKodu!,
    DovizCinsi: 'TL',
    EvrakAciklama: {
      Aciklama1: `Sipariş: ${order.shopifyOrderName ?? order.orderNumber ?? order.id}`,
      Aciklama2: order.customerEmail ?? '',
      Aciklama3: ship.address1 ?? '',
      ...(takipNo ? { Aciklama4: `Kargo Takip: ${takipNo}` } : {}),
      ...(kargoBarkod ? { Aciklama5: `Kargo Barkod: ${kargoBarkod}` } : {}),
    },
    SiparisDurumu: false,
    Satirlar: satirlar,
  };

  const siparisRes = await siparisEkle(evrak);
  if (!siparisRes.ok) {
    await db
      .update(orders)
      .set({
        mikroSyncStatus: 'failed',
        mikroError: `siparisEkle: ${siparisRes.error}`,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    await logAudit({
      actorType: 'system',
      actorId: 'mikro-sync',
      action: 'mikro.order.failed',
      entityType: 'order',
      entityId: orderId,
      after: { step: 'siparisEkle', error: siparisRes.error },
    });
    return { ok: false, orderId, step: 'siparis', error: siparisRes.error };
  }

  await db
    .update(orders)
    .set({
      mikroSyncStatus: 'order_added',
      mikroEvrakSeri: evrakSeri,
      mikroEvrakSira: evrakSira,
      mikroError: null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  // 5. Onayla
  const onayRes = await siparisOnayla({
    EvrakSeri: evrakSeri,
    EvrakSira: evrakSira,
    Tip: 0,
    OnaylayanMikroKullaniciNo: env.MIKRO_APPROVER_USER_NO,
  });
  if (!onayRes.ok) {
    await db
      .update(orders)
      .set({
        mikroSyncStatus: 'failed',
        mikroError: `siparisOnayla: ${onayRes.error}`,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    return { ok: false, orderId, step: 'onay', error: onayRes.error };
  }

  await db
    .update(orders)
    .set({
      mikroSyncStatus: 'approved',
      mikroError: null,
      mikroSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  await logAudit({
    actorType: 'system',
    actorId: 'mikro-sync',
    action: 'mikro.order.approved',
    entityType: 'order',
    entityId: orderId,
    after: { cariKodu, evrakSeri, evrakSira, lineItems: lineItems.length },
  });

  return {
    ok: true,
    orderId,
    cariKodu: cariKodu!,
    evrakSeri,
    evrakSira,
    status: 'approved',
  };
}
