'use server';

import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { routingRules } from '@/db/schema';
import { auth } from '@/lib/auth';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin')) {
    throw new Error('Unauthorized');
  }
}

const ruleSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().or(z.literal('')),
  priority: z.number().int().min(0).max(10000),
  action: z.enum(['split', 'consolidate_self', 'consolidate_carrier']),
  conditions: z.string().min(2), // JSON string olarak gelir, parse ederiz
  enabled: z.boolean().default(true),
});

function parseConditions(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Conditions JSON object olmalı');
  }
  return parsed as Record<string, unknown>;
}

export async function createRoutingRuleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const data = ruleSchema.parse({
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    priority: Number(formData.get('priority') ?? 100),
    action: String(formData.get('action') ?? 'split'),
    conditions: String(formData.get('conditions') ?? '{}'),
    enabled: formData.get('enabled') === 'on' || formData.get('enabled') === 'true',
  });

  const conditionsObj = parseConditions(data.conditions);

  await db.insert(routingRules).values({
    name: data.name,
    description: data.description || null,
    priority: data.priority,
    action: data.action,
    conditions: conditionsObj,
    enabled: data.enabled,
  });

  revalidatePath('/admin/routing-rules');
}

export async function updateRoutingRuleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ruleId = z.string().uuid().parse(formData.get('ruleId'));
  const data = ruleSchema.parse({
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    priority: Number(formData.get('priority') ?? 100),
    action: String(formData.get('action') ?? 'split'),
    conditions: String(formData.get('conditions') ?? '{}'),
    enabled: formData.get('enabled') === 'on' || formData.get('enabled') === 'true',
  });

  const conditionsObj = parseConditions(data.conditions);

  await db
    .update(routingRules)
    .set({
      name: data.name,
      description: data.description || null,
      priority: data.priority,
      action: data.action,
      conditions: conditionsObj,
      enabled: data.enabled,
      updatedAt: new Date(),
    })
    .where(eq(routingRules.id, ruleId));

  revalidatePath('/admin/routing-rules');
}

export async function deleteRoutingRuleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ruleId = z.string().uuid().parse(formData.get('ruleId'));
  await db.delete(routingRules).where(eq(routingRules.id, ruleId));
  revalidatePath('/admin/routing-rules');
}

export async function toggleRoutingRuleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ruleId = z.string().uuid().parse(formData.get('ruleId'));
  await db
    .update(routingRules)
    .set({ enabled: sql`NOT ${routingRules.enabled}`, updatedAt: new Date() })
    .where(eq(routingRules.id, ruleId));
  revalidatePath('/admin/routing-rules');
}
