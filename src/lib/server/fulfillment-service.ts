/**
 * Fulfillment service — order line item'ları kargo paketine dönüştürür.
 *
 * Akış (split mode için, MVP):
 *   1. Vendor'ın KargoLab sender address'i var mı? Yoksa vendor profiline göre yarat.
 *   2. Order'ın bu vendor'a ait line items'larını topla.
 *   3. Müşteri shipping address'i normalize et.
 *   4. KargoLab createShipment çağır.
 *   5. fulfillments + fulfillment_line_items DB'ye yaz.
 *   6. Line items status'u 'awaiting_pickup' → mevcut.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  fulfillmentLineItems,
  fulfillments,
  orderEvents,
  orderLineItems,
  orders,
  productVariants,
  vendors,
} from '@/db/schema';
import {
  createKargoLabAddress,
  createKargoLabShipment,
  listSenderAddresses,
  type KargoLabAddress,
  type ShipmentCommodity,
  type ShipmentDimension,
} from '@/lib/kargolab/shipments';
import { pushFulfillmentToShopify } from '@/lib/shopify/fulfillment-push';
import { notifyNativeOrderShipped } from '@/lib/orders/lifecycle';

interface CreateOk {
  ok: true;
  fulfillmentId: string;
  kargolabShipmentId: number;
  barcode?: string;
  trackingNumber?: string;
}
interface CreateErr {
  ok: false;
  error: string;
}
export type CreateFulfillmentResult = CreateOk | CreateErr;

interface VendorMeta {
  kargolabSenderAddressId?: number;
  [key: string]: unknown;
}

// TR plaka kodları (en çok kullanılan iller). Eksik il = '34' fallback.
const TR_STATE_CODE: Record<string, string> = {
  'adana': '01', 'adıyaman': '02', 'afyon': '03', 'afyonkarahisar': '03',
  'ağrı': '04', 'amasya': '05', 'ankara': '06', 'antalya': '07',
  'artvin': '08', 'aydın': '09', 'balıkesir': '10', 'bilecik': '11',
  'bingöl': '12', 'bitlis': '13', 'bolu': '14', 'burdur': '15',
  'bursa': '16', 'çanakkale': '17', 'çankırı': '18', 'çorum': '19',
  'denizli': '20', 'diyarbakır': '21', 'edirne': '22', 'elazığ': '23',
  'erzincan': '24', 'erzurum': '25', 'eskişehir': '26', 'gaziantep': '27',
  'giresun': '28', 'gümüşhane': '29', 'hakkari': '30', 'hatay': '31',
  'isparta': '32', 'mersin': '33', 'içel': '33', 'istanbul': '34',
  'i̇stanbul': '34', 'i̇zmir': '35', 'izmir': '35', 'kars': '36',
  'kastamonu': '37', 'kayseri': '38', 'kırklareli': '39', 'kırşehir': '40',
  'kocaeli': '41', 'konya': '42', 'kütahya': '43', 'malatya': '44',
  'manisa': '45', 'kahramanmaraş': '46', 'mardin': '47', 'muğla': '48',
  'muş': '49', 'nevşehir': '50', 'niğde': '51', 'ordu': '52',
  'rize': '53', 'sakarya': '54', 'samsun': '55', 'siirt': '56',
  'sinop': '57', 'sivas': '58', 'tekirdağ': '59', 'tokat': '60',
  'trabzon': '61', 'tunceli': '62', 'şanlıurfa': '63', 'uşak': '64',
  'van': '65', 'yozgat': '66', 'zonguldak': '67', 'aksaray': '68',
  'bayburt': '69', 'karaman': '70', 'kırıkkale': '71', 'batman': '72',
  'şırnak': '73', 'bartın': '74', 'ardahan': '75', 'ığdır': '76',
  'yalova': '77', 'karabük': '78', 'kilis': '79', 'osmaniye': '80',
  'düzce': '81',
};

function stateCodeFromName(state: string | null | undefined): string {
  if (!state) return '34';
  const key = state.toLocaleLowerCase('tr-TR').trim();
  return TR_STATE_CODE[key] ?? '34';
}

async function ensureSenderAddress(vendorId: string): Promise<
  { ok: true; addressId: number } | { ok: false; error: string }
> {
  const [vendor] = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      legalName: vendors.legalName,
      email: vendors.email,
      phone: vendors.phone,
      addressLine1: vendors.addressLine1,
      addressLine2: vendors.addressLine2,
      city: vendors.city,
      district: vendors.district,
      postalCode: vendors.postalCode,
      country: vendors.country,
      metadata: vendors.metadata,
    })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) return { ok: false, error: 'Vendor bulunamadı' };

  const meta = (vendor.metadata as VendorMeta | null) ?? {};
  if (meta.kargolabSenderAddressId) {
    return { ok: true, addressId: meta.kargolabSenderAddressId };
  }

  if (!vendor.addressLine1 || !vendor.city || !vendor.district) {
    return {
      ok: false,
      error: 'Vendor adres bilgileri eksik (adres / il / ilçe)',
    };
  }

  const result = await createKargoLabAddress({
    address_type: 1,
    contact_name: vendor.legalName ?? vendor.name,
    company_name: vendor.name,
    address1: vendor.addressLine1,
    address2: vendor.addressLine2 ?? '-',
    address_description: 'Vendor merkez',
    zipcode: vendor.postalCode ?? '00000',
    town: vendor.district,
    city: vendor.district,
    state: vendor.city,
    state_code: stateCodeFromName(vendor.city),
    country: vendor.country ?? 'TR',
    email: vendor.email,
    phone: vendor.phone ?? '',
  });

  if (result.ok) {
    await db
      .update(vendors)
      .set({
        metadata: { ...meta, kargolabSenderAddressId: result.addressId },
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId));
    return { ok: true, addressId: result.addressId };
  }

  // Yetki yok / hata → mevcut KargoLab adreslerinden default sender'ı dene.
  // Tek-vendor (Via Mood) MVP için yeterli; multi-vendor'da her vendor için kendi
  // KargoLab subaccount'unun adresi gerekir.
  const existing = await listSenderAddresses();
  const fallback = existing.find((a) => a.isDefault) ?? existing[0];
  if (fallback) {
    await db
      .update(vendors)
      .set({
        metadata: {
          ...meta,
          kargolabSenderAddressId: fallback.id,
          kargolabSenderFallback: true,
        },
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId));
    return { ok: true, addressId: fallback.id };
  }

  return { ok: false, error: result.error + ' (mevcut sender adres da yok)' };
}

interface CreateOptions {
  /** Default: 'PTT' */
  courrier?: string;
  /** Default: 2 (Paket) */
  packagingType?: 1 | 2 | 3 | 4;
}

export async function createFulfillmentForOrderVendor(
  orderId: string,
  vendorId: string,
  options: CreateOptions = {},
): Promise<CreateFulfillmentResult> {
  const courrier = options.courrier ?? 'PTT';
  const packagingType = options.packagingType ?? 2;

  // Aynı vendor için aynı order'da zaten bir fulfillment var mı? (idempotency)
  const [existing] = await db
    .select({ id: fulfillments.id, kargolabShipmentId: fulfillments.kargolabShipmentId })
    .from(fulfillments)
    .where(and(eq(fulfillments.orderId, orderId), eq(fulfillments.vendorId, vendorId)))
    .limit(1);
  if (existing) {
    return {
      ok: true,
      fulfillmentId: existing.id,
      kargolabShipmentId: Number(existing.kargolabShipmentId ?? 0),
    };
  }

  const [order] = await db
    .select({
      id: orders.id,
      orderName: orders.shopifyOrderName,
      orderNumber: orders.orderNumber,
      shippingAddress: orders.shippingAddress,
      customerEmail: orders.customerEmail,
      customerPhone: orders.customerPhone,
      customerName: orders.customerName,
      tags: orders.tags,
      totalCents: orders.totalCents,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return { ok: false, error: 'Order bulunamadı' };
  if (!order.shippingAddress) return { ok: false, error: 'Shipping address yok' };

  const lis = await db
    .select({
      id: orderLineItems.id,
      variantId: orderLineItems.variantId,
      title: orderLineItems.title,
      sku: orderLineItems.sku,
      quantity: orderLineItems.quantity,
      unitPriceCents: orderLineItems.unitPriceCents,
      weightGrams: productVariants.weightGrams,
    })
    .from(orderLineItems)
    .leftJoin(productVariants, eq(productVariants.id, orderLineItems.variantId))
    .where(and(eq(orderLineItems.orderId, orderId), eq(orderLineItems.vendorId, vendorId)));

  if (lis.length === 0) return { ok: false, error: 'Bu vendor için line item yok' };

  const senderRes = await ensureSenderAddress(vendorId);
  if (!senderRes.ok) return senderRes;

  const ship = order.shippingAddress as Record<string, string | undefined>;
  const receiver: KargoLabAddress = {
    contact_name: ship.name ?? order.customerName ?? 'Müşteri',
    address1: ship.address1 ?? '-',
    address2: ship.address2 ?? '-',
    address_description: 'Müşteri teslimat',
    zipcode: ship.postalCode ?? '00000',
    town: ship.district ?? ship.city ?? '',
    city: ship.district ?? ship.city ?? '',
    state: ship.city ?? '',
    state_code: stateCodeFromName(ship.city),
    country: ship.countryCode ?? 'TR',
    email: order.customerEmail ?? undefined,
    phone: ship.phone ?? order.customerPhone ?? '',
  };

  const totalWeightGrams = lis.reduce(
    (acc, li) => acc + (li.weightGrams ?? 500) * li.quantity,
    0,
  );
  const totalWeightKg = Math.max(0.1, totalWeightGrams / 1000);

  const dimensions: ShipmentDimension[] = [
    { width: 20, length: 20, height: 15, quantity: 1, gw: totalWeightKg.toFixed(2) },
  ];

  const commoduties: ShipmentCommodity[] = lis.map((li) => ({
    title: li.title,
    sku: li.sku ?? '',
    qty: li.quantity,
    weight: (li.weightGrams ?? 500) / 1000,
    price: (Number(li.unitPriceCents) / 100).toFixed(2),
    currency: 'TRY',
    total_price: (Number(li.unitPriceCents) * li.quantity) / 100,
  }));

  // Kapıda ödeme (COD) siparişi mi? → tahsilatlı kargo: kurye sipariş tutarını kapıda tahsil eder.
  const isCod = (order.tags ?? []).some((t) =>
    ['kapida-odeme', 'tahsilatli-kargo', 'cod'].includes(String(t).toLowerCase()),
  );
  const codAmount = isCod ? Math.round(Number(order.totalCents)) / 100 : 0;
  const COD_PAYMENT_TYPE: 1 | 2 | 3 = 3; // KargoLab: 3 = kapıda ödeme (tahsilatlı). İlk COD kargoda doğrula.

  const shipRes = await createKargoLabShipment({
    courrier,
    addresses: {
      sender_id: senderRes.addressId,
      receiver,
    },
    commodity_description: lis.map((li) => li.title).slice(0, 3).join(', ').slice(0, 200),
    commoduties,
    dimensions,
    packaging_type: packagingType,
    payment_type: isCod ? COD_PAYMENT_TYPE : 1,
    ...(isCod ? { payment_at_door: codAmount } : {}),
    waybill: order.orderName ?? order.orderNumber ?? undefined,
    tracking_number: order.orderName ?? order.orderNumber ?? undefined,
    order_number: order.orderName ?? order.orderNumber ?? undefined,
    insurance_value: 0,
    insurance_currency: 'TRY',
    additional_services: 0,
  });

  if (!shipRes.ok) return shipRes;

  let fulfillmentId = '';
  await db.transaction(async (tx) => {
    const [fulfillment] = await tx
      .insert(fulfillments)
      .values({
        orderId,
        vendorId,
        kargolabShipmentId: String(shipRes.shipmentId),
        carrier: courrier,
        trackingNumber: shipRes.barcode ?? shipRes.trackingNumber ?? null,
        trackingUrl: shipRes.barcode
          ? `https://kargolab.com/track/${shipRes.barcode}`
          : null,
        status: 'label_created',
        shipFromAddress: { kargolabAddressId: senderRes.addressId },
        shipToAddress: ship as Record<string, unknown>,
        packageWeightGrams: totalWeightGrams,
        packageDimensionsCm: { length: 20, width: 20, height: 15 },
        labelCreatedAt: new Date(),
        metadata: { kargolabResponse: shipRes.raw as Record<string, unknown> },
      })
      .returning({ id: fulfillments.id });

    if (!fulfillment) throw new Error('fulfillment insert başarısız');
    fulfillmentId = fulfillment.id;

    await tx.insert(fulfillmentLineItems).values(
      lis.map((li) => ({
        fulfillmentId: fulfillment.id,
        lineItemId: li.id,
        quantity: li.quantity,
      })),
    );

    await tx
      .update(orderLineItems)
      .set({ status: 'shipped' })
      .where(
        and(
          eq(orderLineItems.orderId, orderId),
          eq(orderLineItems.vendorId, vendorId),
        ),
      );

    await tx.insert(orderEvents).values({
      orderId,
      eventType: 'fulfillment.created',
      actorType: 'vendor',
      actorId: vendorId,
      payload: {
        fulfillmentId: fulfillment.id,
        kargolabShipmentId: shipRes.shipmentId,
        barcode: shipRes.barcode,
        carrier: courrier,
      },
    });
  });

  // Shopify'a fulfillment'ı push et — best-effort. Hata olsa local fulfillment kalsın.
  pushFulfillmentToShopify(fulfillmentId).catch((err) => {
    console.error('[shopify.fulfillmentCreate] failed:', err);
  });

  // Native sipariş ise "kargoya verildi" e-postası (Shopify shipment maili yerine) — best-effort
  notifyNativeOrderShipped(orderId, {
    carrier: courrier,
    trackingNumber: shipRes.barcode ?? shipRes.trackingNumber ?? null,
    trackingUrl: shipRes.barcode ? `https://kargolab.com/track/${shipRes.barcode}` : null,
  }).catch(() => {});

  return {
    ok: true,
    fulfillmentId,
    kargolabShipmentId: shipRes.shipmentId,
    barcode: shipRes.barcode,
    trackingNumber: shipRes.trackingNumber,
  };
}
