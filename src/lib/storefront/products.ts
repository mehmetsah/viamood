import { and, desc, eq, ilike, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { products, productVariants } from '@/db/schema';
import type { SfProduct } from './types';

export type { SfProduct } from './types';
export { discountPct } from './types';

export async function getStorefrontProducts(
  opts: { limit?: number; q?: string; cat?: string } = {},
): Promise<SfProduct[]> {
  const conds = [
    eq(products.status, 'active'),
    isNull(products.deletedAt),
    isNotNull(products.shopifyHandle),
  ];
  if (opts.q) conds.push(ilike(products.title, `%${opts.q}%`));
  if (opts.cat) conds.push(eq(products.productType, opts.cat));

  const rows = await db
    .select({
      id: products.id,
      handle: products.shopifyHandle,
      title: products.title,
      image: products.featuredImageUrl,
      min: products.minPriceCents,
      vendor: products.vendorName,
    })
    .from(products)
    .where(and(...conds))
    .orderBy(desc(products.createdAt))
    .limit(opts.limit ?? 60);

  if (!rows.length) return [];

  // compareAt (indirim) — variant'lardan max, product başına
  const ids = rows.map((r) => r.id);
  const cmp = await db
    .select({
      pid: productVariants.productId,
      maxCmp: sql<string | null>`max(${productVariants.compareAtPriceCents})`,
    })
    .from(productVariants)
    .where(inArray(productVariants.productId, ids))
    .groupBy(productVariants.productId);
  const cmpMap = new Map(cmp.map((c) => [c.pid, c.maxCmp != null ? Number(c.maxCmp) : null]));

  return rows.map((r) => {
    const price = Number(r.min ?? 0);
    const ca = cmpMap.get(r.id) ?? null;
    return {
      id: r.id,
      handle: r.handle as string,
      title: r.title,
      image: r.image,
      priceCents: price,
      compareAtCents: ca && ca > price ? ca : null,
      vendor: r.vendor,
    };
  });
}
