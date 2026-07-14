import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventoryLevels, productVariants, products, vendors } from '@/db/schema';

/**
 * Shopify ürününü AWS multivendor DB'ye ingest eder (upsert).
 * - Webhook (products/create|update) ve backfill aynı yolu kullanır.
 * - shopifyProductId ile idempotent: varsa günceller, yoksa oluşturur.
 * - Shopify `vendor` alanı → AWS vendor eşlemesi (Via Mood → asrin-plastik, niş'ler isimle).
 */

export interface ShopifyProductVariantPayload {
  id: number | string;
  title?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price?: string | null;
  compare_at_price?: string | null;
  grams?: number | null;
  inventory_item_id?: number | string | null;
  inventory_quantity?: number | null;
  requires_shipping?: boolean;
  taxable?: boolean;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
}

export interface ShopifyProductPayload {
  id: number | string;
  handle: string;
  title: string;
  body_html?: string | null;
  product_type?: string | null;
  tags?: string | string[];
  status?: string; // active | draft | archived
  vendor?: string;
  image?: { src?: string } | null;
  images?: Array<{ src?: string }>;
  variants?: ShopifyProductVariantPayload[];
}

export interface ProductIngestResult {
  ok: boolean;
  productId?: string;
  isNew?: boolean;
  variantCount?: number;
  vendorSlug?: string;
  error?: string;
}

/** Shopify vendor adı (lowercase) → AWS vendor slug özel eşlemesi. */
// Via Mood'un KENDİ ürünleri Via'nın vendor'ına atanır (Asrın'a DEĞİL).
// Not: 'via-mood' vendor'ı canlıda tanımlı olmalı; yoksa resolveVendor eski fallback'e
// (asrin-plastik) düşer — yani vendor oluşturulana kadar bu eşleme güvenle no-op'tur.
const VENDOR_NAME_OVERRIDE: Record<string, string> = {
  'via mood': 'via-mood',
  viamood: 'via-mood',
};

function toCents(price?: string | null): bigint {
  if (price == null) return 0n;
  const n = Math.round(parseFloat(String(price)) * 100);
  return BigInt(Number.isFinite(n) ? n : 0);
}

function trLower(s: string): string {
  return (s || '').trim().toLocaleLowerCase('tr');
}

let _vendorCache: Array<{ id: string; slug: string; name: string }> | null = null;
async function getVendors() {
  if (_vendorCache) return _vendorCache;
  _vendorCache = await db
    .select({ id: vendors.id, slug: vendors.slug, name: vendors.name })
    .from(vendors);
  return _vendorCache;
}

async function resolveVendor(shopifyVendorName: string) {
  const all = await getVendors();
  const key = trLower(shopifyVendorName);
  const overrideSlug = VENDOR_NAME_OVERRIDE[key];
  if (overrideSlug) {
    const v = all.find((x) => x.slug === overrideSlug);
    if (v) return v;
  }
  const byName = all.find((x) => trLower(x.name) === key);
  if (byName) return byName;
  const bySlug = all.find((x) => trLower(x.slug) === key);
  if (bySlug) return bySlug;
  // Fallback: ana hat (asrin-plastik), yoksa ilk vendor.
  return all.find((x) => x.slug === 'asrin-plastik') ?? all[0] ?? null;
}

export async function ingestShopifyProduct(
  p: ShopifyProductPayload,
): Promise<ProductIngestResult> {
  try {
    const shopifyProductId = String(p.id);
    const vendor = await resolveVendor(p.vendor || '');
    if (!vendor) return { ok: false, error: 'vendor bulunamadı (vendors tablosu boş?)' };

    const variants = p.variants ?? [];
    const prices = variants.map((v) => toCents(v.price)).filter((c) => c > 0n);
    const minPrice = prices.length ? prices.reduce((a, b) => (a < b ? a : b)) : null;
    const maxPrice = prices.length ? prices.reduce((a, b) => (a > b ? a : b)) : null;
    const totalInv = variants.reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0);

    const tags = Array.isArray(p.tags)
      ? p.tags
      : p.tags
        ? String(p.tags).split(',').map((t) => t.trim()).filter(Boolean)
        : [];
    const status: 'draft' | 'active' | 'archived' =
      p.status === 'active' ? 'active' : p.status === 'archived' ? 'archived' : 'draft';
    const featuredImageUrl = p.image?.src ?? p.images?.[0]?.src ?? null;

    const out = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.shopifyProductId, shopifyProductId))
        .limit(1);

      const productValues = {
        vendorId: vendor.id,
        shopifyProductId,
        shopifyHandle: p.handle,
        title: p.title,
        description: p.body_html ?? null,
        productType: p.product_type ?? null,
        tags,
        status,
        vendorSlug: vendor.slug,
        vendorName: vendor.name,
        minPriceCents: minPrice,
        maxPriceCents: maxPrice,
        totalInventory: totalInv,
        featuredImageUrl,
        updatedAt: new Date(),
      };

      let productId: string;
      let isNew: boolean;
      if (existing) {
        await tx.update(products).set(productValues).where(eq(products.id, existing.id));
        productId = existing.id;
        isNew = false;
      } else {
        const [ins] = await tx
          .insert(products)
          .values(productValues)
          .returning({ id: products.id });
        productId = ins!.id;
        isNew = true;
      }

      for (const v of variants) {
        const svid = String(v.id);
        const variantValues = {
          productId,
          vendorId: vendor.id,
          shopifyVariantId: svid,
          shopifyInventoryItemId: v.inventory_item_id != null ? String(v.inventory_item_id) : null,
          title: v.title ?? null,
          sku: v.sku ?? null,
          barcode: v.barcode ?? null,
          priceCents: toCents(v.price),
          compareAtPriceCents: v.compare_at_price ? toCents(v.compare_at_price) : null,
          weightGrams: v.grams ?? null,
          requiresShipping: v.requires_shipping ?? true,
          isTaxable: v.taxable ?? true,
          option1: v.option1 ?? null,
          option2: v.option2 ?? null,
          option3: v.option3 ?? null,
          updatedAt: new Date(),
        };
        const [exV] = await tx
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(eq(productVariants.shopifyVariantId, svid))
          .limit(1);

        let variantId: string;
        if (exV) {
          await tx.update(productVariants).set(variantValues).where(eq(productVariants.id, exV.id));
          variantId = exV.id;
        } else {
          const [insV] = await tx
            .insert(productVariants)
            .values(variantValues)
            .returning({ id: productVariants.id });
          variantId = insV!.id;
        }

        // Inventory level (idempotent — composite PK vendor+variant)
        await tx
          .insert(inventoryLevels)
          .values({
            vendorId: vendor.id,
            variantId,
            quantity: v.inventory_quantity ?? 0,
            available: v.inventory_quantity ?? 0,
          })
          .onConflictDoUpdate({
            target: [inventoryLevels.vendorId, inventoryLevels.variantId],
            set: {
              quantity: v.inventory_quantity ?? 0,
              available: v.inventory_quantity ?? 0,
              updatedAt: new Date(),
            },
          });
      }

      return { productId, isNew, variantCount: variants.length };
    });

    return { ok: true, vendorSlug: vendor.slug, ...out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
