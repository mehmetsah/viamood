/**
 * FAZ 3.3 tohumu — Tedarikçiden TOPLANACAK sipariş kalemleri.
 *
 * `stockLocation='supplier_pickup'` işaretli ürünlerin, henüz gönderilmemiş
 * (pending | awaiting_pickup) sipariş kalemlerini tedarikçi (vendor) bazında gruplar.
 * Bu, günlük toplama rotasının girdisidir: hangi tedarikçiden hangi kalemler alınacak.
 *
 * SALT-OKUR. Rota oluşturma / durum değiştirme YOK (FAZ 3.3'te eklenecek).
 * Not: stockLocation şu an products'tan okunur (join). İleride sipariş anında
 * order_line_items'a snapshot alınabilir (ürün konumu sonradan değişirse geçmiş bozulmasın).
 */
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import { orderLineItems, orders, products, vendors } from '@/db/schema';

export interface PickupItem {
  orderId: string;
  orderNumber: string | null;
  orderName: string | null;
  lineItemId: string;
  title: string;
  sku: string | null;
  quantity: number;
  status: string;
}

export interface PickupVendorGroup {
  vendorId: string;
  vendorName: string;
  city: string | null;
  district: string | null;
  itemCount: number;
  totalQuantity: number;
  items: PickupItem[];
}

export interface PickupListOptions {
  /** Bu tarihten sonra verilen siparişler (varsayılan: sınırsız). */
  since?: Date;
  /** Bu tarihten önce (exclusive). */
  until?: Date;
}

/**
 * Toplama listesini vendor bazında gruplayıp döndürür (en çok adetten aza sıralı).
 */
export async function getPickupList(
  opts: PickupListOptions = {},
): Promise<PickupVendorGroup[]> {
  const conds = [
    eq(products.stockLocation, 'supplier_pickup'),
    inArray(orderLineItems.status, ['pending', 'awaiting_pickup']),
  ];
  if (opts.since) conds.push(gte(orders.placedAt, opts.since));
  if (opts.until) conds.push(lt(orders.placedAt, opts.until));

  const rows = await db
    .select({
      vendorId: orderLineItems.vendorId,
      vendorName: vendors.name,
      city: vendors.city,
      district: vendors.district,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      orderName: orders.shopifyOrderName,
      lineItemId: orderLineItems.id,
      title: orderLineItems.title,
      sku: orderLineItems.sku,
      quantity: orderLineItems.quantity,
      status: orderLineItems.status,
    })
    .from(orderLineItems)
    .innerJoin(products, eq(orderLineItems.productId, products.id))
    .innerJoin(orders, eq(orderLineItems.orderId, orders.id))
    .innerJoin(vendors, eq(orderLineItems.vendorId, vendors.id))
    .where(and(...conds));

  const byVendor = new Map<string, PickupVendorGroup>();
  for (const r of rows) {
    let g = byVendor.get(r.vendorId);
    if (!g) {
      g = {
        vendorId: r.vendorId,
        vendorName: r.vendorName,
        city: r.city,
        district: r.district,
        itemCount: 0,
        totalQuantity: 0,
        items: [],
      };
      byVendor.set(r.vendorId, g);
    }
    g.items.push({
      orderId: r.orderId,
      orderNumber: r.orderNumber,
      orderName: r.orderName,
      lineItemId: r.lineItemId,
      title: r.title,
      sku: r.sku,
      quantity: r.quantity,
      status: r.status,
    });
    g.itemCount += 1;
    g.totalQuantity += r.quantity;
  }

  return Array.from(byVendor.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
}
