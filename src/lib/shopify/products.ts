import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  inventoryLevels,
  products,
  productVariants,
  shopifyConnections,
  vendors,
} from '@/db/schema';
import { isNull } from 'drizzle-orm';
import { shopifyGraphQL } from './client';

/**
 * Vendor platform → Shopify ürün senkronizasyonu.
 *
 * Akış:
 *   1. Local product + default variant DB'den çekilir
 *   2. productSet mutation (idempotent) ile Shopify'a yazılır
 *   3. Dönen Shopify product/variant/inventoryItem ID'leri DB'ye yazılır
 *   4. shopifyProductId artık `local_xxx` değil, gerçek `gid://shopify/Product/...`
 *
 * productSet referans: https://shopify.dev/docs/api/admin-graphql/latest/mutations/productSet
 */

interface PushProductOk {
  ok: true;
  shopifyProductId: string;
  shopifyVariantId: string;
  shopifyInventoryItemId: string | null;
  shopifyHandle: string;
}
interface PushProductErr {
  ok: false;
  error: string;
}
export type PushProductResult = PushProductOk | PushProductErr;

interface ProductSetResponse {
  productSet: {
    product: {
      id: string;
      handle: string;
      status: string;
      variants: {
        edges: Array<{
          node: {
            id: string;
            sku: string | null;
            inventoryItem: { id: string } | null;
          };
        }>;
      };
    } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

const PRODUCT_SET_MUTATION = /* GraphQL */ `
  mutation ProductSet($input: ProductSetInput!) {
    productSet(input: $input, synchronous: true) {
      product {
        id
        handle
        status
        variants(first: 50) {
          edges {
            node {
              id
              sku
              inventoryItem {
                id
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function centsToDecimal(cents: bigint | null | undefined): string | undefined {
  if (cents == null) return undefined;
  const n = Number(cents);
  return (n / 100).toFixed(2);
}

function statusToShopify(status: string): 'ACTIVE' | 'DRAFT' | 'ARCHIVED' {
  if (status === 'active') return 'ACTIVE';
  if (status === 'archived') return 'ARCHIVED';
  return 'DRAFT';
}

export async function pushProductToShopify(productId: string): Promise<PushProductResult> {
  const [row] = await db
    .select({
      productId: products.id,
      vendorId: products.vendorId,
      shopifyProductId: products.shopifyProductId,
      title: products.title,
      description: products.description,
      productType: products.productType,
      tags: products.tags,
      status: products.status,
      handle: products.shopifyHandle,
      featuredImageUrl: products.featuredImageUrl,
      vendorName: vendors.name,
      variantId: productVariants.id,
      variantShopifyId: productVariants.shopifyVariantId,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
      priceCents: productVariants.priceCents,
      compareAtPriceCents: productVariants.compareAtPriceCents,
      weightGrams: productVariants.weightGrams,
      requiresShipping: productVariants.requiresShipping,
      isTaxable: productVariants.isTaxable,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .where(eq(products.id, productId))
    .limit(1);

  if (!row) return { ok: false, error: 'Ürün bulunamadı' };

  // Gerçek Shopify ID'si (gid://shopify/Product/... veya saf numerik) DIŞINDAKİ her şey
  // (local_, pending://, vb. placeholder) "yeni" sayılır → input.id GÖNDERİLMEZ, productSet CREATE eder.
  // Aksi halde pending:// gibi geçersiz bir ID input.id olarak gidip "GraphQL errors" hatasına yol açar.
  const isRealShopifyId =
    row.shopifyProductId.startsWith('gid://shopify/Product/') ||
    /^\d+$/.test(row.shopifyProductId);
  const isNew = !isRealShopifyId;

  const input: Record<string, unknown> = {
    title: row.title,
    descriptionHtml: row.description ?? '',
    productType: row.productType ?? '',
    tags: row.tags ?? [],
    status: statusToShopify(row.status),
    handle: row.handle,
    vendor: row.vendorName,
    productOptions: [
      {
        name: 'Title',
        position: 1,
        values: [{ name: 'Default Title' }],
      },
    ],
    variants: [
      {
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        price: centsToDecimal(row.priceCents) ?? '0.00',
        compareAtPrice: centsToDecimal(row.compareAtPriceCents),
        sku: row.sku ?? undefined,
        barcode: row.barcode ?? undefined,
        taxable: row.isTaxable,
        inventoryPolicy: 'DENY',
        inventoryItem: {
          tracked: true,
          requiresShipping: row.requiresShipping,
          measurement: row.weightGrams
            ? {
                weight: {
                  value: row.weightGrams / 1000, // grams → kg
                  unit: 'KILOGRAMS',
                },
              }
            : undefined,
        },
      },
    ],
  };

  if (!isNew) {
    input.id = row.shopifyProductId;
  }
  if (row.featuredImageUrl) {
    input.files = [
      {
        contentType: 'IMAGE',
        originalSource: row.featuredImageUrl,
      },
    ];
  }

  let response: ProductSetResponse;
  try {
    response = await shopifyGraphQL<ProductSetResponse>(PRODUCT_SET_MUTATION, { input });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Shopify çağrısı başarısız',
    };
  }

  const errors = response.productSet.userErrors;
  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.map((e) => `${e.field?.join('.') ?? '_'}: ${e.message}`).join('; '),
    };
  }

  const product = response.productSet.product;
  if (!product) return { ok: false, error: 'productSet boş döndü' };

  const variantNode = product.variants.edges[0]?.node;
  if (!variantNode) return { ok: false, error: 'Variant dönmedi' };

  const shopifyProductId = product.id;
  const shopifyVariantId = variantNode.id;
  const shopifyInventoryItemId = variantNode.inventoryItem?.id ?? null;
  const shopifyHandle = product.handle;

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        shopifyProductId,
        shopifyHandle,
        updatedAt: new Date(),
      })
      .where(eq(products.id, row.productId));

    await tx
      .update(productVariants)
      .set({
        shopifyVariantId,
        shopifyInventoryItemId,
        updatedAt: new Date(),
      })
      .where(eq(productVariants.id, row.variantId));
  });

  // Inventory'i de senkronla (best-effort — başarısız olsa bile product push başarılı sayılır)
  if (shopifyInventoryItemId) {
    await syncInventoryToShopify(row.variantId, shopifyInventoryItemId).catch((err) => {
      console.error('[shopify.inventory] sync failed:', err);
    });
  }

  return {
    ok: true,
    shopifyProductId,
    shopifyVariantId,
    shopifyInventoryItemId,
    shopifyHandle,
  };
}

interface InventoryActivateResponse {
  inventoryActivate: {
    inventoryLevel: {
      id: string;
      quantities: Array<{ name: string; quantity: number }>;
    } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

interface InventorySetResponse {
  inventorySetQuantities: {
    inventoryAdjustmentGroup: { id: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

const INVENTORY_ACTIVATE = /* GraphQL */ `
  mutation InventoryActivate($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
    inventoryActivate(
      inventoryItemId: $inventoryItemId
      locationId: $locationId
      available: $available
    ) {
      inventoryLevel {
        id
        quantities(names: ["available"]) {
          name
          quantity
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const INVENTORY_SET_QUANTITIES = /* GraphQL */ `
  mutation InventorySet($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Vendor inventory_levels.available değerini Shopify'a yansıt.
 * İlk çağrıda inventoryActivate (item + location bağlama + ilk miktar).
 * Sonraki çağrılarda inventorySetQuantities (mutlak miktar set).
 */
export async function syncInventoryToShopify(
  variantId: string,
  shopifyInventoryItemId: string,
): Promise<{ ok: true; quantity: number } | { ok: false; error: string }> {
  const [conn] = await db
    .select({
      shopDomain: shopifyConnections.shopDomain,
      primaryLocationId: shopifyConnections.primaryLocationId,
    })
    .from(shopifyConnections)
    .where(isNull(shopifyConnections.uninstalledAt))
    .limit(1);

  if (!conn?.primaryLocationId) {
    return { ok: false, error: 'Shopify primary location bulunamadı' };
  }

  const locationGid = conn.primaryLocationId.startsWith('gid://')
    ? conn.primaryLocationId
    : `gid://shopify/Location/${conn.primaryLocationId}`;

  const [level] = await db
    .select({
      vendorId: inventoryLevels.vendorId,
      variantId: inventoryLevels.variantId,
      available: inventoryLevels.available,
      shopifyLocationId: inventoryLevels.shopifyLocationId,
    })
    .from(inventoryLevels)
    .where(eq(inventoryLevels.variantId, variantId))
    .limit(1);

  if (!level) return { ok: false, error: 'Inventory level bulunamadı' };

  // productSet zaten inventory item'i primary location'a tracked=true ile activate ediyor.
  // O yüzden inventoryActivate çağırmadan direkt inventorySetQuantities ile mutlak miktarı set ediyoruz.
  // Eğer item başka bir location'a aktive edilmemişse yine de set çalışır.
  if (!level.shopifyLocationId) {
    // Best-effort activate (item başka location'da değilse no-op olabilir)
    await shopifyGraphQL<InventoryActivateResponse>(INVENTORY_ACTIVATE, {
      inventoryItemId: shopifyInventoryItemId,
      locationId: locationGid,
    }).catch(() => undefined);
  }

  // 2026-04 forward-compatible: ignoreCompareQuantity + compareQuantity kaldırılıyor.
  // Yerine per-entry compareQuantity: null (compare check'i atla) kullanıyoruz.
  // 2025-01'de hâlâ çalışır (transition period); 2026-04+ zorunlu format budur.
  const setRes = await shopifyGraphQL<InventorySetResponse>(INVENTORY_SET_QUANTITIES, {
    input: {
      name: 'available',
      reason: 'correction',
      referenceDocumentUri: `viamood://inventory-sync/${variantId}`,
      quantities: [
        {
          inventoryItemId: shopifyInventoryItemId,
          locationId: locationGid,
          quantity: level.available,
          compareQuantity: null,
        },
      ],
    },
  });
  if (setRes.inventorySetQuantities.userErrors.length > 0) {
    return {
      ok: false,
      error: setRes.inventorySetQuantities.userErrors.map((e) => e.message).join('; '),
    };
  }

  await db
    .update(inventoryLevels)
    .set({
      shopifyLocationId: locationGid,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(inventoryLevels.vendorId, level.vendorId),
        eq(inventoryLevels.variantId, level.variantId),
      ),
    );

  return { ok: true, quantity: level.available };
}
