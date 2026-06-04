/**
 * Bundle → Shopify push.
 *
 * Bundle Shopify'da ayrı bir ürün olarak yayınlanır:
 *   - Kendi SKU + handle + title + image
 *   - Bundle price (vendor'un belirlediği özel fiyat)
 *   - Vendor field: displayVendorName (admin karma için "Via Mood")
 *   - Tek variant (Default)
 *   - Inventory: bundle.inventoryQuantity (hazırlanmış set sayısı)
 *
 * Komponentlerin stoğu Shopify'a yansımaz — Shopify sadece bundle SKU'sunu görür.
 * Bizim DB komponent stoğunu zaten allocate ediyor (prepareBundleStock).
 */
import { eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { productBundles, shopifyConnections } from '@/db/schema';
import { shopifyGraphQL } from './client';

interface ProductSetResp {
  productSet: {
    product: {
      id: string;
      handle: string;
      status: string;
      variants: {
        edges: Array<{ node: { id: string; inventoryItem: { id: string } | null } }>;
      };
    } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

interface InventorySetResp {
  inventorySetQuantities: {
    inventoryAdjustmentGroup: { id: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

const PRODUCT_SET = /* GraphQL */ `
  mutation BundleSet($input: ProductSetInput!) {
    productSet(input: $input, synchronous: true) {
      product {
        id
        handle
        status
        variants(first: 5) {
          edges { node { id inventoryItem { id } } }
        }
      }
      userErrors { field message }
    }
  }
`;

const INVENTORY_SET = /* GraphQL */ `
  mutation InventorySet($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup { id }
      userErrors { field message }
    }
  }
`;

interface PushOk {
  ok: true;
  shopifyProductId: string;
  shopifyVariantId: string;
  shopifyHandle: string;
}
interface PushErr {
  ok: false;
  error: string;
}
export type BundlePushResult = PushOk | PushErr;

function centsToDecimal(cents: bigint | null | undefined): string {
  if (cents == null) return '0.00';
  return (Number(cents) / 100).toFixed(2);
}

export async function pushBundleToShopify(bundleId: string): Promise<BundlePushResult> {
  const [bundle] = await db
    .select()
    .from(productBundles)
    .where(eq(productBundles.id, bundleId))
    .limit(1);
  if (!bundle) return { ok: false, error: 'Bundle bulunamadı' };

  const isNew = !bundle.shopifyProductId;

  const input: Record<string, unknown> = {
    title: bundle.title,
    handle: bundle.handle,
    descriptionHtml: bundle.description ?? '',
    productType: 'Set',
    tags: ['set', 'bundle'],
    status: bundle.status === 'active' ? 'ACTIVE' : 'DRAFT',
    vendor: bundle.displayVendorName ?? 'Via Mood',
    productOptions: [
      { name: 'Title', position: 1, values: [{ name: 'Default Title' }] },
    ],
    variants: [
      {
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        price: centsToDecimal(bundle.bundlePriceCents),
        sku: bundle.sku,
        taxable: true,
        inventoryPolicy: 'DENY',
        inventoryItem: {
          tracked: true,
          requiresShipping: true,
          measurement: bundle.packageWeightGrams
            ? {
                weight: {
                  value: bundle.packageWeightGrams / 1000,
                  unit: 'KILOGRAMS',
                },
              }
            : undefined,
        },
      },
    ],
  };
  if (!isNew) {
    input.id = bundle.shopifyProductId;
  }
  // Görseller: ana + galeri. Shopify ilk file'ı featured kabul eder.
  const galleryRaw = (bundle.galleryImageUrls ?? []) as string[];
  const files: Array<{ contentType: 'IMAGE'; originalSource: string }> = [];
  if (bundle.featuredImageUrl) {
    files.push({ contentType: 'IMAGE', originalSource: bundle.featuredImageUrl });
  }
  for (const url of galleryRaw) {
    if (!url || url === bundle.featuredImageUrl) continue;
    files.push({ contentType: 'IMAGE', originalSource: url });
    if (files.length >= 10) break; // Shopify default media limit
  }
  if (files.length > 0) {
    input.files = files;
  }

  let res: ProductSetResp;
  try {
    res = await shopifyGraphQL<ProductSetResp>(PRODUCT_SET, { input });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Shopify çağrısı fail' };
  }

  if (res.productSet.userErrors.length > 0) {
    return {
      ok: false,
      error: res.productSet.userErrors.map((e) => `${e.field?.join('.')}: ${e.message}`).join('; '),
    };
  }
  const p = res.productSet.product;
  if (!p) return { ok: false, error: 'productSet boş' };
  const v = p.variants.edges[0]?.node;
  if (!v) return { ok: false, error: 'variant dönmedi' };

  // Inventory set — bundle.inventoryQuantity
  if (v.inventoryItem) {
    const [conn] = await db
      .select({ primaryLocationId: shopifyConnections.primaryLocationId })
      .from(shopifyConnections)
      .where(isNull(shopifyConnections.uninstalledAt))
      .limit(1);
    if (conn?.primaryLocationId) {
      const locGid = conn.primaryLocationId.startsWith('gid://')
        ? conn.primaryLocationId
        : `gid://shopify/Location/${conn.primaryLocationId}`;
      // 2026-04 forward-compatible: ignoreCompareQuantity yerine
      // per-entry compareQuantity: null (compare check'i atla).
      await shopifyGraphQL<InventorySetResp>(INVENTORY_SET, {
        input: {
          name: 'available',
          reason: 'correction',
          referenceDocumentUri: `viamood://bundle-sync/${bundle.id}`,
          quantities: [
            {
              inventoryItemId: v.inventoryItem.id,
              locationId: locGid,
              quantity: bundle.inventoryQuantity,
              compareQuantity: null,
            },
          ],
        },
      }).catch((e) => console.error('[bundle inventory]', e));
    }
  }

  await db
    .update(productBundles)
    .set({
      shopifyProductId: p.id,
      shopifyVariantId: v.id,
      shopifyInventoryItemId: v.inventoryItem?.id ?? null,
      shopifyHandle: p.handle,
      updatedAt: new Date(),
    })
    .where(eq(productBundles.id, bundleId));

  return {
    ok: true,
    shopifyProductId: p.id,
    shopifyVariantId: v.id,
    shopifyHandle: p.handle,
  };
}
