/**
 * Bundle (set ürün) servisi.
 *
 * Yetkiler:
 *   - Vendor: sadece kendi product_variants'larından bundle yapar (vendorId zorunlu)
 *   - Admin: vendorId = null → karma bundle (tüm vendorların ürünleri)
 *
 * Stok hareketi:
 *   - prepareBundleStock(setCount): her komponentten (qty × setCount) düşür,
 *     bundle.inventory_quantity'yi setCount kadar artır
 *   - unprepareBundleStock(setCount): tersini yap
 *
 * Snapshot:
 *   - bundle_components.{cost,price,shipping}_snapshot bundle yaratılınca dondurulur
 *   - Bundle "düzenlenince" snapshot tazelenir
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  bundleComponents,
  inventoryLevels,
  productBundles,
  productVariants,
  products,
  vendors,
} from '@/db/schema';

// ============================================================================
// Tipler
// ============================================================================

export interface BundleComponentInput {
  /** Variant ID */
  variantId: string;
  /** Set başına bu komponentten kaç adet */
  quantity: number;
}

export interface CreateBundleInput {
  /** Vendor bundle'ı için zorunlu. Admin karma bundle için null bırak. */
  vendorId: string | null;
  title: string;
  sku: string;
  handle: string;
  description?: string;
  featuredImageUrl?: string;
  /** Vendor'un belirlediği özel satış fiyatı (TL cent) */
  bundlePriceCents: number;
  /** İlk batch'te kaç set hazırlanacak — komponentlerden bu kadar set için stok düşülür */
  initialSetCount?: number;
  /** Set paketinin kendi kargo bilgisi */
  packageWeightGrams?: number;
  packageDimensionsCm?: { length: number; width: number; height: number };
  /** Komponentler — en az 2 farklı variant zorunlu */
  components: BundleComponentInput[];
}

export interface BundleMetrics {
  totalCostCents: number;
  normalPriceCents: number;
  bundlePriceCents: number;
  discountCents: number;
  discountPercent: number;
  /** Komponentlerin tek tek satılması durumunda kargo toplam (TL cent) */
  individualShippingCents: number;
  /** Set kargo (TL cent) */
  bundleShippingCents: number;
  shippingSavingsCents: number;
  profitIfSoldIndividuallyCents: number;
  profitIfSoldAsBundleCents: number;
  profitDifferenceCents: number;
  /** Komponent başına kar payı (set kar × cost_oran) */
  componentProfitShare: Array<{
    variantId: string;
    sku: string | null;
    title: string;
    quantity: number;
    costShare: number; // 0..1
    profitShareCents: number;
  }>;
}

interface CreateOk {
  ok: true;
  bundleId: string;
}
interface CreateErr {
  ok: false;
  error: string;
}
export type BundleResult = CreateOk | CreateErr;

// ============================================================================
// Shipping rate (basit varsayım — vendor / env'den override edilebilir)
// ============================================================================

/** kg başına TL cent. Default: 50 TL / kg + 30 TL base */
const SHIPPING_BASE_CENTS = 3000;
const SHIPPING_PER_KG_CENTS = 5000;

function calcShippingCents(weightGrams: number | null | undefined): number {
  if (!weightGrams || weightGrams <= 0) return SHIPPING_BASE_CENTS;
  const kg = weightGrams / 1000;
  return SHIPPING_BASE_CENTS + Math.round(kg * SHIPPING_PER_KG_CENTS);
}

// ============================================================================
// Variant snapshot — bundle hesabı için
// ============================================================================

interface VariantSnapshot {
  variantId: string;
  vendorId: string;
  productId: string;
  sku: string | null;
  title: string;
  priceCents: bigint;
  costCents: bigint | null;
  weightGrams: number | null;
  available: number;
}

async function fetchVariantSnapshots(
  variantIds: string[],
  scopeVendorId: string | null,
): Promise<
  | { ok: true; data: Map<string, VariantSnapshot> }
  | { ok: false; error: string }
> {
  if (variantIds.length === 0) {
    return { ok: false, error: 'En az 1 komponent gerek' };
  }
  const rows = await db
    .select({
      variantId: productVariants.id,
      vendorId: productVariants.vendorId,
      productId: productVariants.productId,
      sku: productVariants.sku,
      title: products.title,
      priceCents: productVariants.priceCents,
      costCents: productVariants.costCents,
      weightGrams: productVariants.weightGrams,
      available: inventoryLevels.available,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      inventoryLevels,
      and(
        eq(inventoryLevels.variantId, productVariants.id),
        eq(inventoryLevels.vendorId, productVariants.vendorId),
      ),
    )
    .where(inArray(productVariants.id, variantIds));

  if (rows.length !== variantIds.length) {
    const found = new Set(rows.map((r) => r.variantId));
    const missing = variantIds.filter((v) => !found.has(v));
    return { ok: false, error: `Variant bulunamadı: ${missing.join(', ')}` };
  }

  // Vendor scope check
  if (scopeVendorId) {
    const wrong = rows.filter((r) => r.vendorId !== scopeVendorId);
    if (wrong.length > 0) {
      return { ok: false, error: 'Sadece kendi ürünlerinden bundle yapabilirsin' };
    }
  }

  const m = new Map<string, VariantSnapshot>();
  for (const r of rows) {
    m.set(r.variantId, {
      variantId: r.variantId,
      vendorId: r.vendorId,
      productId: r.productId,
      sku: r.sku,
      title: r.title,
      priceCents: r.priceCents,
      costCents: r.costCents,
      weightGrams: r.weightGrams,
      available: r.available ?? 0,
    });
  }
  return { ok: true, data: m };
}

// ============================================================================
// Profit hesabı (mevcut bundle için)
// ============================================================================

export async function computeBundleMetrics(bundleId: string): Promise<BundleMetrics | null> {
  const [bundle] = await db
    .select({
      id: productBundles.id,
      bundlePriceCents: productBundles.bundlePriceCents,
      packageWeightGrams: productBundles.packageWeightGrams,
    })
    .from(productBundles)
    .where(eq(productBundles.id, bundleId))
    .limit(1);
  if (!bundle) return null;

  const components = await db
    .select({
      variantId: bundleComponents.variantId,
      quantity: bundleComponents.quantity,
      costSnapshot: bundleComponents.costSnapshotCents,
      priceSnapshot: bundleComponents.priceSnapshotCents,
      shippingSnapshot: bundleComponents.shippingSnapshotCents,
      sku: productVariants.sku,
      title: products.title,
    })
    .from(bundleComponents)
    .innerJoin(productVariants, eq(productVariants.id, bundleComponents.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(bundleComponents.bundleId, bundleId));

  let totalCost = 0;
  let normalPrice = 0;
  let individualShipping = 0;
  for (const c of components) {
    totalCost += Number(c.costSnapshot ?? 0n) * c.quantity;
    normalPrice += Number(c.priceSnapshot) * c.quantity;
    individualShipping += Number(c.shippingSnapshot ?? 0n) * c.quantity;
  }
  const bundleShipping = calcShippingCents(bundle.packageWeightGrams);
  const bundlePrice = Number(bundle.bundlePriceCents);

  const profitNormal = normalPrice - totalCost - individualShipping;
  const profitBundle = bundlePrice - totalCost - bundleShipping;

  const componentProfitShare = components.map((c) => {
    const cCost = Number(c.costSnapshot ?? 0n) * c.quantity;
    const share = totalCost > 0 ? cCost / totalCost : 0;
    return {
      variantId: c.variantId,
      sku: c.sku,
      title: c.title,
      quantity: c.quantity,
      costShare: share,
      profitShareCents: Math.round(profitBundle * share),
    };
  });

  return {
    totalCostCents: totalCost,
    normalPriceCents: normalPrice,
    bundlePriceCents: bundlePrice,
    discountCents: normalPrice - bundlePrice,
    discountPercent: normalPrice > 0 ? (normalPrice - bundlePrice) / normalPrice : 0,
    individualShippingCents: individualShipping,
    bundleShippingCents: bundleShipping,
    shippingSavingsCents: individualShipping - bundleShipping,
    profitIfSoldIndividuallyCents: profitNormal,
    profitIfSoldAsBundleCents: profitBundle,
    profitDifferenceCents: profitBundle - profitNormal,
    componentProfitShare,
  };
}

// ============================================================================
// Bundle CRUD
// ============================================================================

export async function createBundle(input: CreateBundleInput): Promise<BundleResult> {
  if (!input.title?.trim()) return { ok: false, error: 'Başlık zorunlu' };
  if (!input.sku?.trim()) return { ok: false, error: 'SKU zorunlu' };
  if (!input.handle?.trim()) return { ok: false, error: 'Handle zorunlu' };
  if (input.bundlePriceCents <= 0) return { ok: false, error: 'Fiyat 0\'dan büyük olmalı' };
  if (!input.components || input.components.length < 2) {
    return { ok: false, error: 'En az 2 farklı komponent gerek' };
  }
  for (const c of input.components) {
    if (c.quantity <= 0) return { ok: false, error: 'Komponent miktarı > 0 olmalı' };
  }

  const variantIds = input.components.map((c) => c.variantId);
  const snapsRes = await fetchVariantSnapshots(variantIds, input.vendorId);
  if (!snapsRes.ok) return snapsRes;
  const snaps = snapsRes.data;

  // Set hazırlama isteği varsa stok kontrol
  const setCount = input.initialSetCount ?? 0;
  if (setCount > 0) {
    for (const c of input.components) {
      const s = snaps.get(c.variantId)!;
      const needed = c.quantity * setCount;
      if (s.available < needed) {
        return {
          ok: false,
          error: `${s.title} stok yetersiz (${s.available} adet var, ${needed} adet gerek)`,
        };
      }
    }
  }

  // Karma bundle (admin) için vendor name
  let displayVendorName = 'Via Mood';
  if (input.vendorId) {
    const [v] = await db
      .select({ name: vendors.name })
      .from(vendors)
      .where(eq(vendors.id, input.vendorId))
      .limit(1);
    if (v) displayVendorName = v.name;
  }

  let bundleId = '';
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(productBundles)
      .values({
        vendorId: input.vendorId,
        title: input.title.trim(),
        sku: input.sku.trim(),
        handle: input.handle.trim(),
        description: input.description ?? null,
        featuredImageUrl: input.featuredImageUrl ?? null,
        bundlePriceCents: BigInt(input.bundlePriceCents),
        inventoryQuantity: setCount,
        packageWeightGrams: input.packageWeightGrams ?? null,
        packageDimensionsCm: input.packageDimensionsCm ?? null,
        displayVendorName,
        status: 'draft',
      })
      .returning({ id: productBundles.id });

    if (!created) throw new Error('bundle insert fail');
    bundleId = created.id;

    // Komponentler + snapshot
    for (const c of input.components) {
      const s = snaps.get(c.variantId)!;
      const shipping = calcShippingCents(s.weightGrams);
      await tx.insert(bundleComponents).values({
        bundleId: created.id,
        variantId: c.variantId,
        quantity: c.quantity,
        costSnapshotCents: s.costCents,
        priceSnapshotCents: s.priceCents,
        shippingSnapshotCents: BigInt(shipping),
      });
    }

    // Set hazırlama → stok düş
    if (setCount > 0) {
      for (const c of input.components) {
        const s = snaps.get(c.variantId)!;
        const toRemove = c.quantity * setCount;
        await tx
          .update(inventoryLevels)
          .set({
            available: sql`${inventoryLevels.available} - ${toRemove}`,
            quantity: sql`${inventoryLevels.quantity} - ${toRemove}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(inventoryLevels.variantId, c.variantId),
              eq(inventoryLevels.vendorId, s.vendorId),
            ),
          );
      }
    }
  });

  return { ok: true, bundleId };
}

/** Stok hazırla — mevcut bundle'a N set ekle (komponentlerden düş). */
export async function prepareBundleStock(
  bundleId: string,
  setCount: number,
): Promise<{ ok: true; newInventory: number } | { ok: false; error: string }> {
  if (setCount <= 0) return { ok: false, error: 'setCount > 0 olmalı' };

  const [bundle] = await db
    .select({ id: productBundles.id, inventoryQuantity: productBundles.inventoryQuantity })
    .from(productBundles)
    .where(eq(productBundles.id, bundleId))
    .limit(1);
  if (!bundle) return { ok: false, error: 'Bundle bulunamadı' };

  const components = await db
    .select({
      variantId: bundleComponents.variantId,
      quantity: bundleComponents.quantity,
      vendorId: productVariants.vendorId,
      available: inventoryLevels.available,
      productTitle: products.title,
    })
    .from(bundleComponents)
    .innerJoin(productVariants, eq(productVariants.id, bundleComponents.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      inventoryLevels,
      and(
        eq(inventoryLevels.variantId, productVariants.id),
        eq(inventoryLevels.vendorId, productVariants.vendorId),
      ),
    )
    .where(eq(bundleComponents.bundleId, bundleId));

  // Stok kontrol
  for (const c of components) {
    const needed = c.quantity * setCount;
    const available = c.available ?? 0;
    if (available < needed) {
      return {
        ok: false,
        error: `${c.productTitle} stok yetersiz (${available} var, ${needed} gerek)`,
      };
    }
  }

  let newInv = 0;
  await db.transaction(async (tx) => {
    for (const c of components) {
      const toRemove = c.quantity * setCount;
      await tx
        .update(inventoryLevels)
        .set({
          available: sql`${inventoryLevels.available} - ${toRemove}`,
          quantity: sql`${inventoryLevels.quantity} - ${toRemove}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventoryLevels.variantId, c.variantId),
            eq(inventoryLevels.vendorId, c.vendorId),
          ),
        );
    }
    const [upd] = await tx
      .update(productBundles)
      .set({
        inventoryQuantity: sql`${productBundles.inventoryQuantity} + ${setCount}`,
        updatedAt: new Date(),
      })
      .where(eq(productBundles.id, bundleId))
      .returning({ inv: productBundles.inventoryQuantity });
    newInv = upd?.inv ?? 0;
  });

  return { ok: true, newInventory: newInv };
}

/** Stok boz — bundle'dan N seti söküp komponentlere geri ekle. */
export async function unprepareBundleStock(
  bundleId: string,
  setCount: number,
): Promise<{ ok: true; newInventory: number } | { ok: false; error: string }> {
  if (setCount <= 0) return { ok: false, error: 'setCount > 0 olmalı' };

  const [bundle] = await db
    .select({ id: productBundles.id, inventoryQuantity: productBundles.inventoryQuantity })
    .from(productBundles)
    .where(eq(productBundles.id, bundleId))
    .limit(1);
  if (!bundle) return { ok: false, error: 'Bundle bulunamadı' };
  if (bundle.inventoryQuantity < setCount) {
    return { ok: false, error: `Sadece ${bundle.inventoryQuantity} set mevcut` };
  }

  const components = await db
    .select({
      variantId: bundleComponents.variantId,
      quantity: bundleComponents.quantity,
      vendorId: productVariants.vendorId,
    })
    .from(bundleComponents)
    .innerJoin(productVariants, eq(productVariants.id, bundleComponents.variantId))
    .where(eq(bundleComponents.bundleId, bundleId));

  let newInv = 0;
  await db.transaction(async (tx) => {
    for (const c of components) {
      const toAdd = c.quantity * setCount;
      await tx
        .update(inventoryLevels)
        .set({
          available: sql`${inventoryLevels.available} + ${toAdd}`,
          quantity: sql`${inventoryLevels.quantity} + ${toAdd}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventoryLevels.variantId, c.variantId),
            eq(inventoryLevels.vendorId, c.vendorId),
          ),
        );
    }
    const [upd] = await tx
      .update(productBundles)
      .set({
        inventoryQuantity: sql`${productBundles.inventoryQuantity} - ${setCount}`,
        updatedAt: new Date(),
      })
      .where(eq(productBundles.id, bundleId))
      .returning({ inv: productBundles.inventoryQuantity });
    newInv = upd?.inv ?? 0;
  });

  return { ok: true, newInventory: newInv };
}

export async function archiveBundle(
  bundleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [bundle] = await db
    .select({ id: productBundles.id, inventoryQuantity: productBundles.inventoryQuantity })
    .from(productBundles)
    .where(eq(productBundles.id, bundleId))
    .limit(1);
  if (!bundle) return { ok: false, error: 'Bundle bulunamadı' };

  // Önce stoğu boz → komponentlere geri yansıt
  if (bundle.inventoryQuantity > 0) {
    const res = await unprepareBundleStock(bundleId, bundle.inventoryQuantity);
    if (!res.ok) return res;
  }
  await db
    .update(productBundles)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(productBundles.id, bundleId));
  return { ok: true };
}

/** Bundle status değiştir (draft ↔ active) */
export async function setBundleStatus(
  bundleId: string,
  status: 'draft' | 'active',
): Promise<{ ok: true } | { ok: false; error: string }> {
  await db
    .update(productBundles)
    .set({ status, updatedAt: new Date() })
    .where(eq(productBundles.id, bundleId));
  return { ok: true };
}
