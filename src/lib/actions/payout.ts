'use server';

import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db/client';
import { commissionLedger, payouts, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
import { auditUser } from '@/lib/audit/logger';
import type { ActionResult } from './auth';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin')) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

const createPayoutSchema = z.object({
  vendorId: z.string().uuid(),
  periodStart: z.string(), // YYYY-MM-DD
  periodEnd: z.string(),
  method: z.enum(['iyzico_split', 'iyzico_transfer', 'manual_bank', 'paytr_bk']),
  note: z.string().max(500).optional(),
});

/**
 * Vendor için belirtilen periyot aralığında 'accrued' ledger entry'leri toplar,
 * draft payout batch yaratır.
 */
export async function createPayoutBatchAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const data = createPayoutSchema.parse({
    vendorId: formData.get('vendorId'),
    periodStart: String(formData.get('periodStart') ?? ''),
    periodEnd: String(formData.get('periodEnd') ?? ''),
    method: String(formData.get('method') ?? 'manual_bank'),
    note: formData.get('note') ? String(formData.get('note')) : undefined,
  });

  const startDate = new Date(`${data.periodStart}T00:00:00`);
  const endDate = new Date(`${data.periodEnd}T23:59:59`);

  if (startDate > endDate) {
    throw new Error('Bitiş tarihi başlangıçtan önce olamaz');
  }

  // Vendor info
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, data.vendorId)).limit(1);
  if (!vendor) throw new Error('Vendor bulunamadı');

  // 'accrued' ledger entry'leri topla
  const [agg] = await db
    .select({
      gross: sql<string>`COALESCE(SUM(${commissionLedger.grossAmountCents}), 0)::text`,
      commission: sql<string>`COALESCE(SUM(${commissionLedger.commissionAmountCents}), 0)::text`,
      payout: sql<string>`COALESCE(SUM(${commissionLedger.payoutAmountCents}), 0)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(commissionLedger)
    .where(
      and(
        eq(commissionLedger.vendorId, data.vendorId),
        eq(commissionLedger.status, 'accrued'),
        isNull(commissionLedger.payoutBatchId),
        gte(commissionLedger.createdAt, startDate),
        lte(commissionLedger.createdAt, endDate),
      ),
    );

  if (!agg || agg.count === 0) {
    throw new Error('Bu periyotta hak ediş yok — başka periyot dene');
  }

  let payoutId = '';

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(payouts)
      .values({
        vendorId: data.vendorId,
        method: data.method,
        status: 'draft',
        periodStart: startDate,
        periodEnd: endDate,
        grossAmountCents: BigInt(agg.gross),
        commissionAmountCents: BigInt(agg.commission),
        netAmountCents: BigInt(agg.payout),
        currency: 'TRY',
        bankIban: vendor.iban,
        bankAccountHolder: vendor.accountHolderName,
        note: data.note ?? null,
      })
      .returning({ id: payouts.id });

    if (!created) throw new Error('Payout oluşturulamadı');
    payoutId = created.id;

    // Ledger entry'leri bu payout'a bağla
    await tx
      .update(commissionLedger)
      .set({ payoutBatchId: created.id })
      .where(
        and(
          eq(commissionLedger.vendorId, data.vendorId),
          eq(commissionLedger.status, 'accrued'),
          isNull(commissionLedger.payoutBatchId),
          gte(commissionLedger.createdAt, startDate),
          lte(commissionLedger.createdAt, endDate),
        ),
      );
  });

  revalidatePath('/admin/payouts');
  redirect(`/admin/payouts/${payoutId}`);
}

export async function approvePayoutAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const payoutId = z.string().uuid().parse(formData.get('payoutId'));

  await db
    .update(payouts)
    .set({
      status: 'approved',
      approvedByUserId: admin.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(payouts.id, payoutId));

  await auditUser(admin.id!, 'payout.approve', 'payout', payoutId);
  revalidatePath('/admin/payouts');
  revalidatePath(`/admin/payouts/${payoutId}`);
}

export async function markPayoutPaidAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const payoutId = z.string().uuid().parse(formData.get('payoutId'));
  const externalRef = String(formData.get('externalReference') ?? '').slice(0, 200);

  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1);
    if (!p) throw new Error('Payout bulunamadı');

    await tx
      .update(payouts)
      .set({
        status: 'paid',
        paidAt: new Date(),
        externalReference: externalRef || null,
        updatedAt: new Date(),
      })
      .where(eq(payouts.id, payoutId));

    // Ledger'ı paid olarak işaretle
    await tx
      .update(commissionLedger)
      .set({ status: 'paid' })
      .where(eq(commissionLedger.payoutBatchId, payoutId));

    // Vendor toplam payout sayacını güncelle
    await tx
      .update(vendors)
      .set({
        totalPayoutCents: sql`${vendors.totalPayoutCents} + ${p.netAmountCents}`,
      })
      .where(eq(vendors.id, p.vendorId));
  });

  await auditUser(admin.id!, 'payout.paid', 'payout', payoutId, {
    after: { externalReference: externalRef },
  });

  // Email vendor
  const [info] = await db
    .select({
      vendorName: vendors.name,
      vendorEmail: vendors.email,
      netAmount: payouts.netAmountCents,
    })
    .from(payouts)
    .innerJoin(vendors, eq(vendors.id, payouts.vendorId))
    .where(eq(payouts.id, payoutId))
    .limit(1);
  if (info) {
    const formatted = `${(Number(info.netAmount) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
    const { payoutPaidEmail } = await import('@/lib/email/templates');
    const { sendEmail } = await import('@/lib/email/sender');
    void sendEmail({
      to: info.vendorEmail,
      ...payoutPaidEmail(info.vendorName, formatted, externalRef || null),
    });
  }

  revalidatePath('/admin/payouts');
  revalidatePath(`/admin/payouts/${payoutId}`);
}

export async function cancelPayoutAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const payoutId = z.string().uuid().parse(formData.get('payoutId'));

  await db.transaction(async (tx) => {
    await tx
      .update(payouts)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(payouts.id, payoutId));

    // Ledger entry'leri serbest bırak (yeniden batch'lenebilir)
    await tx
      .update(commissionLedger)
      .set({ payoutBatchId: null })
      .where(eq(commissionLedger.payoutBatchId, payoutId));
  });

  revalidatePath('/admin/payouts');
}
