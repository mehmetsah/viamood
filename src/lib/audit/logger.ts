/**
 * Audit logger — kritik işlemler için.
 * KVKK + internal forensics + compliance için zorunlu.
 *
 * Best-effort (hata durumunda main işlem yine de geçer, audit eksik olabilir).
 * Production'da Sentry'ye logla audit fail'leri.
 */
import { db } from '@/db/client';
import { auditLog } from '@/db/schema';

interface AuditInput {
  actorType: 'user' | 'system' | 'webhook';
  actorId?: string;
  actorIp?: string;
  actorUserAgent?: string;
  action: string;        // 'vendor.update', 'product.create', 'payout.approve' vs.
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  note?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      actorIpAddress: input.actorIp ?? null,
      actorUserAgent: input.actorUserAgent ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      note: input.note ?? null,
      metadata: input.metadata ?? {},
      requestId: input.requestId ?? null,
    });
  } catch (err) {
    console.error('[audit] failed to log:', err);
  }
}

/** "user" tipinde audit kısayolu */
export async function auditUser(
  userId: string,
  action: string,
  entityType: string,
  entityId: string | undefined,
  diff?: { before?: Record<string, unknown>; after?: Record<string, unknown>; note?: string },
): Promise<void> {
  await logAudit({
    actorType: 'user',
    actorId: userId,
    action,
    entityType,
    entityId,
    before: diff?.before ?? null,
    after: diff?.after ?? null,
    note: diff?.note,
  });
}
