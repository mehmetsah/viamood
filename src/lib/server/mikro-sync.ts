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
import { cariKayit, siparisEkle } from '@/lib/mikro/operations';
import { mikroFetch } from '@/lib/mikro/client';
import type { MikroEvrak, MikroEvrakAciklama, MikroHareket } from '@/lib/mikro/types';

interface SyncOk {
  ok: true;
  orderId: string;
  cariKodu: string;
  evrakSeri: string;
  evrakSira: number;
  /** ANA FİRMA (fatura, 7782) DB push sonucu — best-effort */
  firma?: { ok: boolean; cariKodu?: string; error?: string };
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

/** Yunus kuralı — ürün toplanınca çıkan İRSALİYEDE adres yazsın:
 *  Aciklama9+Aciklama10 = "Ad Soyad / Adres" (127'şer karaktere bölünür),
 *  Aciklama7 = telefon, Aciklama6 = platform kimliği (Shopify telefonu). */
function evrakAciklamaFields(
  customerName: string | null,
  ship: ShippingAddr,
  telefon: string,
): MikroEvrakAciklama {
  // DİKKAT ters isimlendirme (order-ingest): ship.city = İLÇE, ship.district = İL
  const adres = [ship.address1, ship.address2, ship.city, ship.district].filter(Boolean).join(' ');
  const combined = `${customerName ?? ''} / ${adres}`;
  return {
    Aciklama6: telefon,
    Aciklama7: telefon,
    Aciklama9: combined.slice(0, 127),
    Aciklama10: combined.slice(127, 254),
  };
}

/** ANA FİRMA (fatura) DB'sine push — Yunus'un Woo akışının ikinci bacağı (port 7782).
 *  Farkları: MÜŞTERİ carisi (telefonla dedupe, yoksa aç), stok kodu PREFIX'SİZ,
 *  BelgeNo/tkp = 'VIA'+seri (takip no değil), DepoNo=1. Best-effort. */
async function pushToFirmaDb(params: {
  order: {
    customerName: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    placedAt: Date;
  };
  ship: ShippingAddr;
  lineItems: Array<{
    title: string;
    sku: string | null;
    variantSku: string | null;
    quantity: number;
    unitPriceCents: number | bigint;
    discountCents: number | bigint;
    variantIsTaxable: boolean | null;
  }>;
  orderDigits: string;
  courier?: string | null;
}): Promise<{ ok: boolean; cariKodu?: string; error?: string }> {
  const base = env.MIKRO_FIRMA_API_URL;
  const { order, ship, lineItems, orderDigits } = params;
  // Yunus seri kuralı: firma DB'de pazaryeri belirteci + sipariş no → 'S25976'
  const firmaSeri = `${env.MIKRO_PAZARYERI}${orderDigits}`;
  try {
    // Idempotensi: seri firma DB'sinde zaten varsa ekleme
    const dupe = await mikroFetch<{ Result?: Array<{ adet: number }> }>('/MikroV17/sqlverioku', {
      method: 'POST',
      body: { Query: `SELECT COUNT(*) as adet FROM SIPARISLER WITH (NOLOCK) WHERE sip_evrakno_seri='${firmaSeri.replace(/'/g, '')}'` },
    }, base);
    if ((dupe?.Result?.[0]?.adet ?? 0) > 0) return { ok: true };

    // Cari: telefonla dedupe (Woo akışında email boş geliyor) → yoksa yeni müşteri carisi aç
    const telefon = (order.customerPhone ?? ship.phone ?? '').replace(/[^\d]/g, '').replace(/^90/, ''); // müşteri profili boşsa teslimat adresindeki telefon
    let cariKodu: string | null = null;
    if (telefon.length >= 10) {
      const found = await mikroFetch<{ Result?: Array<{ cari_kod: string }> }>('/MikroV17/sqlverioku', {
        method: 'POST',
        body: { Query: `SELECT TOP 1 cari_kod FROM CARI_HESAPLAR WITH (NOLOCK) WHERE cari_CepTel LIKE '%${telefon.slice(-10)}'` },
      }, base);
      cariKodu = found?.Result?.[0]?.cari_kod ?? null;
    }
    if (!cariKodu) {
      const seq = await nextCariSequence();
      cariKodu = `${env.MIKRO_CARI_PREFIX}${seq}`;
      const { soyad, ad } = splitName(order.customerName);
      const cariRes = await cariKayit({
        UnvaniSoyadi: soyad || '-',
        UnvaniAdi: ad || '.',
        Kodu: cariKodu,
        EpostaAdresi: order.customerEmail ?? '',
        CepTelefonu: telefon.slice(0, 20),
        Telefon1: telefon.slice(0, 20), // cari_CepTel boş kalabiliyor — Telefon1'e de yaz
        Telefon2: '0',
        VergiDaire: '',
        VergiNo: '11111111111',
        WebAdresi: '',
        DovizTip1: 'TL',
        DovizTip2: '',
        EFatura: false,
        VergiMukellefi: false,
        // DİKKAT ters isimlendirme (order-ingest): ship.district = İL, ship.city = İLÇE
        Adres1: {
          Adres: [ship.address1, ship.address2].filter(Boolean).join(' '),
          Ulke: ship.country ?? 'TURKEY',
          Sehir: ship.district ?? ship.city ?? '',
          Kasaba: ship.city ?? '',
          PostaKodu: ship.postalCode ?? '',
        },
        // Yunus: cari adres boş kalıyordu — fatura + sevk adresi de doldurulur
        // (MikroAddressFatura'da serbest 'Adres' alanı yok → satır adresi Cadde'ye yazılır)
        FaturaAdresi: {
          Cadde: [ship.address1, ship.address2].filter(Boolean).join(' '),
          Ulke: ship.country ?? 'TURKEY',
          Sehir: ship.district ?? ship.city ?? '',
          Kasaba: ship.city ?? '',
          PostaKodu: ship.postalCode ?? '',
        },
        SevkAdresi: {
          Cadde: [ship.address1, ship.address2].filter(Boolean).join(' '),
          Ulke: ship.country ?? 'TURKEY',
          Sehir: ship.district ?? ship.city ?? '',
          Kasaba: ship.city ?? '',
          PostaKodu: ship.postalCode ?? '',
        },
      }, base);
      if (!cariRes.ok) return { ok: false, error: `cariKayit(firma): ${cariRes.error}` };
    }

    const placedAtIso = order.placedAt.toISOString().slice(0, 19);
    const viaRef = `VIA${orderDigits}`;
    const satirlar: MikroHareket[] = lineItems.map((li) => {
      const unitPriceTl = Number(li.unitPriceCents) / 100;
      const discountTl = Number(li.discountCents) / 100;
      const kdvOran = li.variantIsTaxable === false ? 0 : 20;
      const fiyatHaric = unitPriceTl / (1 + kdvOran / 100);
      return {
        Id: '{00000000-0000-0000-0000-000000000000}',
        Cinsi: 0,
        StokKodu: String(li.variantSku ?? li.sku ?? '').trim(), // firma DB'de PREFIX'SİZ
        Barkodu: '',
        KDV: fiyatHaric * (kdvOran / 100),
        IstisnaKodu: 0,
        Miktar: li.quantity,
        Fiyat: fiyatHaric,
        Iskonto1: discountTl > 0 ? discountTl / (1 + kdvOran / 100) : 0,
        Iskonto2: 0,
        Iskonto3: 0,
        Iskonto4: 0,
        Iskonto5: 0,
        Aciklama: '',
      };
    });

    const evrak: MikroEvrak = {
      Tarih: placedAtIso,
      TeslimTarihi: placedAtIso,
      TeslimTuruKodu: shippingTeslimTuruKodu(params.courier ?? null),
      SaticiKodu: '',
      SrmMerkezKodu: env.MIKRO_SRM_MERKEZ,
      DepoNo: env.MIKRO_FIRMA_DEPO,
      OdemePlaniNo: env.MIKRO_ODEME_PLANI_NO,
      ProjeKodu: env.MIKRO_PROJE_KODU,
      EvrakSeri: firmaSeri,
      EvrakSira: env.MIKRO_EVRAK_SIRA,
      Tip: 0,
      BelgeNo: viaRef,
      CariHesapKodu: cariKodu,
      DovizCinsi: 'TL',
      DovizKuru: 1.0,
      EvrakDokumAciklamasi: JSON.stringify({
        tkp: viaRef,
        pzr: 'Shopify',
        cid: '0',
        cusr: `telefon: ${telefon}`,
        cns: order.customerName ?? '',
        tel: telefon,
        svka: [ship.address1, ship.address2, ship.district, ship.city].filter(Boolean).join(' '),
      }),
      Vade: 0,
      MikroUserNo: env.MIKRO_APPROVER_USER_NO,
      AdresNo: 1,
      // İrsaliyede adres çıksın (Yunus kuralı): 9+10=Ad Soyad/Adres, 7=tel, 6=platform kimliği
      EvrakAciklama: evrakAciklamaFields(order.customerName, ship, telefon),
      SiparisDurumu: true,
      Satirlar: satirlar,
    };
    const res = await siparisEkle(evrak, base);
    if (!res.ok) return { ok: false, error: `siparisEkle(firma): ${res.error}` };
    return { ok: true, cariKodu };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
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

  // 3. Cari: ARADEPO modunda SABİT cari — Yunus'un günlük Woo→Mikro akışıyla birebir.
  // Müşteri bilgisi evrakın EvrakDokumAciklamasi JSON'unda taşınır; cariKayit GEREKMEZ.
  const cariKodu = env.MIKRO_ARADEPO_CARI;

  // 4. Sipariş ekle (Yunus'un ÇALIŞAN Woo formatı — 2026-07-09'da #1015 ile canlı kanıtlandı)
  const ship = (order.shippingAddress ?? {}) as ShippingAddr;
  // Yunus seri kuralı (çakışma önleme): aradepo = müşteriNo+pazaryeri+siparişNo → '001S25976'
  const orderDigits = String(order.shopifyOrderName ?? order.orderNumber ?? '').replace(/\D/g, '');
  const evrakSeri =
    (order.mikroEvrakSeri ?? '').trim() ||
    (orderDigits ? `${env.MIKRO_MUSTERI_NO}${env.MIKRO_PAZARYERI}${orderDigits}` : '');
  const evrakSira = order.mikroEvrakSira ?? env.MIKRO_EVRAK_SIRA;
  if (!evrakSeri) {
    return { ok: false, orderId, step: 'siparis', error: 'Evrak seri üretilemedi (sipariş numarası yok)' };
  }

  // Idempotensi: seri Mikro'da ZATEN varsa (elle/backfill girilmiş) tekrar EKLEME — çift evrak önlenir
  try {
    const dupe = await mikroFetch<{ Result?: Array<{ adet: number }> }>('/MikroV17/sqlverioku', {
      method: 'POST',
      body: { Query: `SELECT COUNT(*) as adet FROM SIPARISLER WITH (NOLOCK) WHERE sip_evrakno_seri='${evrakSeri.replace(/'/g, '')}'` },
    });
    if ((dupe?.Result?.[0]?.adet ?? 0) > 0) {
      await db
        .update(orders)
        .set({
          mikroSyncStatus: 'approved',
          mikroCariKodu: cariKodu,
          mikroEvrakSeri: evrakSeri,
          mikroEvrakSira: evrakSira,
          mikroError: null,
          mikroSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
      // Aradepo'da zaten var — ama FİRMA DB'de eksik olabilir (backfill senaryosu): firma push yine dene
      let firmaDup: SyncOk['firma'];
      if (env.MIKRO_FIRMA_PUSH && env.MIKRO_FIRMA_API_URL) {
        firmaDup = await pushToFirmaDb({
          order: {
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            placedAt: order.placedAt,
          },
          ship,
          lineItems,
          orderDigits,
          courier: kargo?.courier ?? null,
        });
        if (!firmaDup.ok) console.error('[mikro-sync] FİRMA DB push hatası (dup-dal):', { orderId, error: firmaDup.error });
      }
      return { ok: true, orderId, cariKodu, evrakSeri, evrakSira, firma: firmaDup, status: 'approved' };
    }
  } catch {
    /* kontrol başarısızsa normal akışla devam */
  }

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
    // Yunus'un çalışan formatı: Fiyat = KDV HARİÇ birim fiyat, KDV alanı = KDV TUTARI (oran DEĞİL!)
    const kdvOran = li.variantIsTaxable === false ? 0 : 20;
    const fiyatHaric = unitPriceTl / (1 + kdvOran / 100);
    const kdvTutar = fiyatHaric * (kdvOran / 100);
    return {
      Id: '{00000000-0000-0000-0000-000000000000}',
      Cinsi: 0, // Stok
      StokKodu: stokKodu,
      // Barkodu BİLEREK BOŞ: Mikro SiparisEkle, Barkodu doluysa stok aramasını BARKODLA yapıyor;
      // Shopify barkodu Mikro'da kayıtlı olmadığından "Stok bilgisi bulunamadı" veriyor (kanıtlandı).
      Barkodu: '',
      KDV: kdvTutar,
      IstisnaKodu: 0,
      Miktar: li.quantity,
      Fiyat: fiyatHaric,
      Iskonto1: discountTl > 0 ? discountTl / (1 + kdvOran / 100) : 0,
      Iskonto2: 0,
      Iskonto3: 0,
      Iskonto4: 0,
      Iskonto5: 0,
      Aciklama: '',
    };
  });

  const placedAtIso = order.placedAt.toISOString().slice(0, 19);

  // Kargo takip bilgisi (fulfillment sonrası push'ta dolu gelir)
  const takipNo = kargo?.trackingNumber ?? kargo?.barcode ?? null;
  const telefon = (order.customerPhone ?? ship.phone ?? '').replace(/[^\d]/g, '').replace(/^90/, ''); // müşteri profili boşsa teslimat adresindeki telefon

  const evrak: MikroEvrak = {
    Tarih: placedAtIso,
    TeslimTarihi: placedAtIso,
    TeslimTuruKodu: shippingTeslimTuruKodu(kargo?.courier ?? null), // gerçek kurye (yoksa PTT default)
    SaticiKodu: '',
    SrmMerkezKodu: env.MIKRO_SRM_MERKEZ,
    DepoNo: env.MIKRO_ARADEPO_DEPO,
    OdemePlaniNo: env.MIKRO_ODEME_PLANI_NO,
    ProjeKodu: env.MIKRO_PROJE_KODU,
    EvrakSeri: evrakSeri,
    EvrakSira: evrakSira,
    Tip: 0,
    ...(takipNo ? { BelgeNo: takipNo.slice(0, 50) } : {}),
    CariHesapKodu: cariKodu,
    DovizCinsi: 'TL',
    DovizKuru: 1.0,
    // El terminali/raporlar bu JSON'u okuyor (tkp = kargo takip no) — Yunus'un Woo şemasıyla aynı
    EvrakDokumAciklamasi: JSON.stringify({
      tkp: takipNo ?? '',
      pzr: 'Shopify',
      cid: '0',
      cusr: `telefon: ${telefon}`,
      cns: order.customerName ?? '',
      tel: telefon,
      svka: [ship.address1, ship.address2, ship.district, ship.city].filter(Boolean).join(' '),
    }),
    Vade: 0,
    MikroUserNo: env.MIKRO_APPROVER_USER_NO,
    AdresNo: 1,
    // İrsaliyede adres çıksın (Yunus kuralı): 9+10=Ad Soyad/Adres, 7=tel, 6=platform kimliği
    EvrakAciklama: evrakAciklamaFields(order.customerName, ship, telefon),
    SiparisDurumu: true, // onaylı girer — ayrı SiparisOnayla no-op (Result:false) döndüğü için kaldırıldı
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

  // SiparisDurumu:true ile evrak ONAYLI girer — ayrı SiparisOnayla adımı gerekmez
  await db
    .update(orders)
    .set({
      mikroSyncStatus: 'approved',
      mikroCariKodu: cariKodu,
      mikroEvrakSeri: evrakSeri,
      mikroEvrakSira: evrakSira,
      mikroError: null,
      mikroSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  // ANA FİRMA (fatura) DB'sine de push — best-effort (aradepo asıl; firma hatası pipeline'ı düşürmez)
  let firma: SyncOk['firma'];
  if (env.MIKRO_FIRMA_PUSH && env.MIKRO_FIRMA_API_URL) {
    firma = await pushToFirmaDb({
      order: {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        placedAt: order.placedAt,
      },
      ship,
      lineItems,
      orderDigits,
      courier: kargo?.courier ?? null,
    });
    if (!firma.ok) console.error('[mikro-sync] FİRMA DB push hatası:', { orderId, error: firma.error });
  }

  await logAudit({
    actorType: 'system',
    actorId: 'mikro-sync',
    action: 'mikro.order.approved',
    entityType: 'order',
    entityId: orderId,
    after: { cariKodu, evrakSeri, evrakSira, lineItems: lineItems.length, firma },
  });

  return {
    ok: true,
    orderId,
    cariKodu,
    evrakSeri,
    evrakSira,
    firma,
    status: 'approved',
  };
}
