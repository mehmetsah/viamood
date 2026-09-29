'use server';

/**
 * FAZ 3.3 — Toplama turu aksiyonları (admin).
 * Rota oluşturur ve durak toplama durumunu ilerletir. Canlı sipariş akışına
 * yalnız kalem durumu (pending→awaiting_pickup→collected) üzerinden dokunur.
 */
import { revalidatePath } from 'next/cache';
import { auditUser } from '@/lib/audit/logger';
import { auth } from '@/lib/auth';
import { generatePickupRun, markStopCollected } from '@/lib/routing/pickup-run';
import type { GenerateResult, StopResult } from '@/lib/routing/pickup-run';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin')) {
    throw new Error('Unauthorized: admin yetkisi gerekli');
  }
  return session.user;
}

export async function generatePickupRunAction(): Promise<GenerateResult> {
  const user = await requireAdmin();
  const res = await generatePickupRun(user.id);
  if (res.ok) {
    await auditUser(user.id, 'pickup.run.generate', 'pickup_run', res.runId, {
      note: `Toplama rotası oluşturuldu (${res.stopCount} durak, ${res.itemCount} kalem)`,
    });
  }
  revalidatePath('/admin/toplama');
  return res;
}

export async function markStopCollectedAction(stopId: string): Promise<StopResult> {
  const user = await requireAdmin();
  const res = await markStopCollected(stopId, user.id);
  if (res.ok) {
    await auditUser(user.id, 'pickup.stop.collected', 'pickup_run_stop', stopId, {
      note: 'Durak toplandı',
    });
  }
  revalidatePath('/admin/toplama');
  return res;
}
