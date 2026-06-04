'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { shippingRateBrackets } from '@/db/schema';
import { auth } from '@/lib/auth';
import { auditUser } from '@/lib/audit/logger';
import {
  calcPriceCents,
  pushBracketsToShopify,
  refreshKargolabBase,
} from '@/lib/shipping/rate-manager';
import type { ActionResult } from './auth';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== 'admin' && role !== 'super_admin') throw new Error('Admin yetkisi gerek');
  return session;
}

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  weightLowGrams: z.coerce.number().int().min(0),
  weightHighGrams: z.coerce.number().int().min(1),
  marginPct: z.coerce.number().int().min(-50).max(500),
  marginFlatCents: z.coerce.number().int().min(0).default(0),
  sortOrder: z.coerce.number().int().min(0).default(100),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
});

export async function upsertBracketAction(formData: FormData): Promise<void> {
  const r = await upsertBracketInternal(formData);
  if (!r.success) throw new Error(r.error);
}

async function upsertBracketInternal(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const raw = {
    id: (formData.get('id') as string) || undefined,
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '') || undefined,
    weightLowGrams: Number(formData.get('weightLowGrams') ?? 0),
    weightHighGrams: Number(formData.get('weightHighGrams') ?? 0),
    marginPct: Number(formData.get('marginPct') ?? 15),
    marginFlatCents: Number(formData.get('marginFlatCents') ?? 0),
    sortOrder: Number(formData.get('sortOrder') ?? 100),
    status: (formData.get('status') as 'draft' | 'active' | 'archived') ?? 'active',
  };

  const parsed = upsertSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Form hatası' };

  const d = parsed.data;
  if (d.weightHighGrams <= d.weightLowGrams) {
    return { success: false, error: 'Üst sınır alt sınırdan büyük olmalı' };
  }

  // Existing bracket fetch (kargolab_base'i koruyalım)
  let existingBaseCents: bigint | null = null;
  if (d.id) {
    const [ex] = await db
      .select()
      .from(shippingRateBrackets)
      .where(eq(shippingRateBrackets.id, d.id))
      .limit(1);
    existingBaseCents = ex?.kargolabBaseCents ?? null;
  }

  // Margin uygula → priceCents
  const priceCents = calcPriceCents({
    weightLowGrams: d.weightLowGrams,
    weightHighGrams: d.weightHighGrams,
    marginPct: d.marginPct,
    marginFlatCents: d.marginFlatCents,
    kargolabBaseCents: existingBaseCents,
  });

  if (d.id) {
    await db
      .update(shippingRateBrackets)
      .set({
        name: d.name,
        description: d.description ?? null,
        weightLowGrams: d.weightLowGrams,
        weightHighGrams: d.weightHighGrams,
        marginPct: d.marginPct,
        marginFlatCents: BigInt(d.marginFlatCents),
        priceCents: BigInt(priceCents || 0),
        status: d.status,
        sortOrder: d.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(shippingRateBrackets.id, d.id));
    await auditUser(session!.user!.id, 'shipping.bracket.update', 'shipping_bracket', d.id);
  } else {
    const [created] = await db
      .insert(shippingRateBrackets)
      .values({
        name: d.name,
        description: d.description ?? null,
        weightLowGrams: d.weightLowGrams,
        weightHighGrams: d.weightHighGrams,
        marginPct: d.marginPct,
        marginFlatCents: BigInt(d.marginFlatCents),
        priceCents: BigInt(priceCents || 0),
        status: d.status,
        sortOrder: d.sortOrder,
        countryCode: 'TR',
        currency: 'TRY',
      })
      .returning({ id: shippingRateBrackets.id });
    if (created) {
      await auditUser(session!.user!.id, 'shipping.bracket.create', 'shipping_bracket', created.id);
    }
  }

  revalidatePath('/admin/shipping-rates');
  return { success: true };
}

export async function deleteBracketAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const id = z.string().uuid().parse(formData.get('id'));
  await db.delete(shippingRateBrackets).where(eq(shippingRateBrackets.id, id));
  await auditUser(session!.user!.id, 'shipping.bracket.delete', 'shipping_bracket', id);
  revalidatePath('/admin/shipping-rates');
}

export async function refreshKargolabAction(): Promise<ActionResult & { details?: string }> {
  const session = await requireAdmin();
  const r = await refreshKargolabBase();
  if (!r.ok) return { success: false, error: r.error };
  await auditUser(session!.user!.id, 'shipping.kargolab.refresh', 'shipping', undefined, {
    after: { refreshed: r.refreshed, failed: r.failed },
  } as { after: Record<string, unknown> });
  revalidatePath('/admin/shipping-rates');
  return {
    success: true,
    details: `${r.refreshed} bracket güncellendi, ${r.failed} fail`,
  };
}

export async function pushToShopifyAction(): Promise<ActionResult & { details?: string }> {
  const session = await requireAdmin();
  const r = await pushBracketsToShopify();
  if (!r.ok) return { success: false, error: r.error };
  await auditUser(session!.user!.id, 'shipping.shopify.push', 'shipping', undefined, {
    after: { created: r.created, updated: r.updated, deletedOrphans: r.deletedOrphans },
  });
  revalidatePath('/admin/shipping-rates');
  return {
    success: true,
    details: `${r.created} oluşturuldu, ${r.deletedOrphans} eski temizlendi`,
  };
}
