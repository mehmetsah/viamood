'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { inventoryLevels, productVariants, products } from '@/db/schema';
import { canEdit, requireActiveVendor } from '@/lib/server/vendor-context';
import type { ActionResult } from './auth';

const adjustSchema = z.object({
  variantId: z.string().uuid(),
  delta: z.number().int(),
  reason: z.string().max(200).optional(),
});

const setSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(0).max(1_000_000),
  reason: z.string().max(200).optional(),
});

export async function adjustInventoryAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireActiveVendor();
  if (!canEdit(ctx.role)) return { success: false, error: 'Yetkin yok' };

  const parsed = adjustSchema.safeParse({
    variantId: formData.get('variantId'),
    delta: Number(formData.get('delta')),
    reason: formData.get('reason') ? String(formData.get('reason')) : undefined,
  });
  if (!parsed.success) {
    return { success: false, error: 'Geçersiz veri' };
  }

  const { variantId, delta } = parsed.data;

  // Variant'ın bu vendor'a ait olduğunu doğrula
  const [variant] = await db
    .select({ vendorId: productVariants.vendorId, productId: productVariants.productId })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!variant || variant.vendorId !== ctx.vendorId) {
    return { success: false, error: 'Variant bulunamadı' };
  }

  await db.transaction(async (tx) => {
    // Inventory row var mı?
    const [existing] = await tx
      .select()
      .from(inventoryLevels)
      .where(
        and(eq(inventoryLevels.vendorId, ctx.vendorId), eq(inventoryLevels.variantId, variantId)),
      )
      .limit(1);

    if (!existing) {
      // Yoksa oluştur
      const newQty = Math.max(0, delta);
      await tx.insert(inventoryLevels).values({
        vendorId: ctx.vendorId,
        variantId,
        quantity: newQty,
        available: newQty,
        reserved: 0,
      });
    } else {
      const newQty = Math.max(0, existing.quantity + delta);
      const newAvailable = Math.max(0, newQty - existing.reserved);
      await tx
        .update(inventoryLevels)
        .set({
          quantity: newQty,
          available: newAvailable,
          version: sql`${inventoryLevels.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(eq(inventoryLevels.vendorId, ctx.vendorId), eq(inventoryLevels.variantId, variantId)),
        );
    }

    // Product totalInventory'yi yeniden hesapla (basit: tüm variant'ları topla)
    const sumResult = await tx
      .select({ total: sql<number>`COALESCE(SUM(${inventoryLevels.available}), 0)::int` })
      .from(inventoryLevels)
      .innerJoin(productVariants, eq(productVariants.id, inventoryLevels.variantId))
      .where(eq(productVariants.productId, variant.productId));

    const total = sumResult[0]?.total ?? 0;
    await tx.update(products).set({ totalInventory: total }).where(eq(products.id, variant.productId));
  });

  revalidatePath('/inventory');
  revalidatePath('/products');
  return { success: true };
}

export async function setInventoryAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireActiveVendor();
  if (!canEdit(ctx.role)) return { success: false, error: 'Yetkin yok' };

  const parsed = setSchema.safeParse({
    variantId: formData.get('variantId'),
    quantity: Number(formData.get('quantity')),
    reason: formData.get('reason') ? String(formData.get('reason')) : undefined,
  });
  if (!parsed.success) {
    return { success: false, error: 'Geçersiz veri' };
  }

  const { variantId, quantity } = parsed.data;

  const [variant] = await db
    .select({ vendorId: productVariants.vendorId, productId: productVariants.productId })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!variant || variant.vendorId !== ctx.vendorId) {
    return { success: false, error: 'Variant bulunamadı' };
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(inventoryLevels)
      .where(
        and(eq(inventoryLevels.vendorId, ctx.vendorId), eq(inventoryLevels.variantId, variantId)),
      )
      .limit(1);

    if (!existing) {
      await tx.insert(inventoryLevels).values({
        vendorId: ctx.vendorId,
        variantId,
        quantity,
        available: quantity,
        reserved: 0,
      });
    } else {
      const newAvailable = Math.max(0, quantity - existing.reserved);
      await tx
        .update(inventoryLevels)
        .set({
          quantity,
          available: newAvailable,
          version: sql`${inventoryLevels.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(eq(inventoryLevels.vendorId, ctx.vendorId), eq(inventoryLevels.variantId, variantId)),
        );
    }

    const sumResult = await tx
      .select({ total: sql<number>`COALESCE(SUM(${inventoryLevels.available}), 0)::int` })
      .from(inventoryLevels)
      .innerJoin(productVariants, eq(productVariants.id, inventoryLevels.variantId))
      .where(eq(productVariants.productId, variant.productId));

    const total = sumResult[0]?.total ?? 0;
    await tx.update(products).set({ totalInventory: total }).where(eq(products.id, variant.productId));
  });

  revalidatePath('/inventory');
  revalidatePath('/products');
  return { success: true };
}
