import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import {
  inventoryLevels,
  productVariants,
  products,
  vendorMemberships,
  vendors,
} from '@/db/schema';
import { auth } from '@/lib/auth';
import { InventoryClient } from './InventoryClient';

interface Row {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  quantity: number;
  reserved: number;
  available: number;
}

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  const [membership] = await db
    .select({ vendorId: vendors.id, status: vendors.status })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect('/onboarding');

  const rows: Row[] = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productTitle: products.title,
      variantTitle: productVariants.title,
      sku: productVariants.sku,
      imageUrl: products.featuredImageUrl,
      quantity: inventoryLevels.quantity,
      reserved: inventoryLevels.reserved,
      available: inventoryLevels.available,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      inventoryLevels,
      and(
        eq(inventoryLevels.variantId, productVariants.id),
        eq(inventoryLevels.vendorId, membership.vendorId),
      ),
    )
    .where(and(eq(productVariants.vendorId, membership.vendorId), isNull(products.deletedAt)))
    .limit(500) as Row[];

  // Null inventory row'u 0'a normalize
  const normalized = rows.map((r) => ({
    ...r,
    quantity: r.quantity ?? 0,
    reserved: r.reserved ?? 0,
    available: r.available ?? 0,
  }));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Stok</h1>
      <p className="text-neutral-600 text-sm mb-8">
        Tüm varyantların stok seviyeleri. Stok güncellemesi anında geçer (Phase 2.3'te Shopify'a sync olacak).
      </p>

      {normalized.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border text-center text-neutral-500">
          Henüz ürün yok. Önce ürün ekle.
        </div>
      ) : (
        <InventoryClient rows={normalized} />
      )}
    </div>
  );
}
