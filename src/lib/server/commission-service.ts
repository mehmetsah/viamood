/**
 * Commission ledger akışı.
 *
 * Sipariş `paid` olduğunda her vendor line item için iki ledger entry yaratılır:
 *   1. type=sale → vendor'ın brüt geliri
 *   2. type=commission → platform komisyonu (negative)
 *
 * payout_amount = gross - commission. Bu hesabı kapanma anında dondururuz
 * (commission_rate snapshot olarak entry'e yazılır — vendor sonradan güncellense de
 * eski entry'ler değişmez).
 *
 * Refund:
 *   - reversed status'a alınır, yeni `refund` ve `commission` (negative) entry eklenir.
 *
 * Payout:
 *   - Admin period seçer, `accrued` durumdaki entry'ler toplanır → payout batch yaratılır
 *   - Batch onaylanınca entry'ler `paid` olur, payout_batch_id atanır.
 */
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  commissionLedger,
  orderLineItems,
  orders,
  payouts,
  vendors,
} from '@/db/schema';

interface AccrueOk {
  ok: true;
  orderId: string;
  entriesCreated: number;
  totalGrossCents: bigint;
  totalCommissionCents: bigint;
  totalPayoutCents: bigint;
}
interface AccrueErr {
  ok: false;
  error: string;
}
export type AccrueResult = AccrueOk | AccrueErr;

/**
 * Sipariş için komisyon ledger entry'leri yarat.
 * Idempotent: aynı orderId için tekrar çağrılırsa yeni entry yaratmaz.
 */
export async function accrueCommissionForOrder(orderId: string): Promise<AccrueResult> {
  const [existing] = await db
    .select({ id: commissionLedger.id })
    .from(commissionLedger)
    .where(eq(commissionLedger.orderId, orderId))
    .limit(1);
  if (existing) {
    return { ok: false, error: 'Bu sipariş için zaten ledger entry var' };
  }

  const [order] = await db
    .select({ id: orders.id, financialStatus: orders.financialStatus })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return { ok: false, error: 'Order bulunamadı' };
  if (order.financialStatus !== 'paid' && order.financialStatus !== 'partially_paid') {
    return {
      ok: false,
      error: `Order finansal durumu accrual'a uygun değil: ${order.financialStatus}`,
    };
  }

  const lis = await db
    .select({
      id: orderLineItems.id,
      vendorId: orderLineItems.vendorId,
      totalPriceCents: orderLineItems.totalPriceCents,
      vendorCommissionRate: vendors.commissionRate,
    })
    .from(orderLineItems)
    .innerJoin(vendors, eq(vendors.id, orderLineItems.vendorId))
    .where(eq(orderLineItems.orderId, orderId));

  if (lis.length === 0) return { ok: false, error: 'Line item yok' };

  let totalGross = 0n;
  let totalCommission = 0n;
  let totalPayout = 0n;
  const inserts: Array<typeof commissionLedger.$inferInsert> = [];

  for (const li of lis) {
    const gross = BigInt(li.totalPriceCents);
    const rateBps = li.vendorCommissionRate;
    const commissionAmount = (gross * BigInt(rateBps)) / 10000n;
    const payoutAmount = gross - commissionAmount;

    inserts.push({
      vendorId: li.vendorId,
      orderId,
      orderLineItemId: li.id,
      type: 'sale',
      status: 'accrued',
      grossAmountCents: gross,
      commissionRateBps: rateBps,
      commissionAmountCents: commissionAmount,
      payoutAmountCents: payoutAmount,
    });
    inserts.push({
      vendorId: li.vendorId,
      orderId,
      orderLineItemId: li.id,
      type: 'commission',
      status: 'accrued',
      grossAmountCents: 0n,
      commissionRateBps: rateBps,
      commissionAmountCents: -commissionAmount,
      payoutAmountCents: 0n,
    });

    totalGross += gross;
    totalCommission += commissionAmount;
    totalPayout += payoutAmount;
  }

  await db.insert(commissionLedger).values(inserts);

  // vendors.total_revenue_cents'i güncelle (denormalize)
  for (const li of lis) {
    await db
      .update(vendors)
      .set({
        totalRevenueCents: sql`${vendors.totalRevenueCents} + ${BigInt(li.totalPriceCents).toString()}`,
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, li.vendorId));
  }

  return {
    ok: true,
    orderId,
    entriesCreated: inserts.length,
    totalGrossCents: totalGross,
    totalCommissionCents: totalCommission,
    totalPayoutCents: totalPayout,
  };
}

// ============================================================================
// Payout batch
// ============================================================================

interface BatchOk {
  ok: true;
  payoutId: string;
  entriesCount: number;
  netAmountCents: bigint;
}

export async function createPayoutBatch(
  vendorId: string,
  periodStart: Date,
  periodEnd: Date,
  method: 'iyzico_split' | 'iyzico_transfer' | 'manual_bank' | 'paytr_bk' = 'manual_bank',
): Promise<BatchOk | { ok: false; error: string }> {
  const [vendor] = await db
    .select({
      id: vendors.id,
      iban: vendors.iban,
      accountHolderName: vendors.accountHolderName,
      legalName: vendors.legalName,
      name: vendors.name,
    })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);
  if (!vendor) return { ok: false, error: 'Vendor yok' };
  if (!vendor.iban) return { ok: false, error: 'Vendor IBAN yok' };

  const eligibleEntries = await db
    .select({
      id: commissionLedger.id,
      gross: commissionLedger.grossAmountCents,
      commission: commissionLedger.commissionAmountCents,
      payout: commissionLedger.payoutAmountCents,
      type: commissionLedger.type,
    })
    .from(commissionLedger)
    .where(
      and(
        eq(commissionLedger.vendorId, vendorId),
        eq(commissionLedger.status, 'accrued'),
        gte(commissionLedger.createdAt, periodStart),
        lte(commissionLedger.createdAt, periodEnd),
      ),
    );

  if (eligibleEntries.length === 0) {
    return { ok: false, error: 'Bu periyotta accrued entry yok' };
  }

  let totalGross = 0n;
  let totalNet = 0n;
  for (const e of eligibleEntries) {
    totalGross += BigInt(e.gross);
    totalNet += BigInt(e.payout);
  }
  // Komisyon = gross - net (sale ve commission entry'leri net'lerken kendi içinde sıfırlandığı için
  // direkt subtraction kullanılır)
  const commissionAbs = totalGross - totalNet;

  const ids = eligibleEntries.map((e) => e.id);

  let payoutId = '';
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(payouts)
      .values({
        vendorId,
        method,
        status: 'draft',
        periodStart,
        periodEnd,
        grossAmountCents: totalGross,
        commissionAmountCents: commissionAbs,
        feeAmountCents: 0n,
        netAmountCents: totalNet,
        bankIban: vendor.iban,
        bankAccountHolder: vendor.accountHolderName ?? vendor.legalName ?? vendor.name,
      })
      .returning({ id: payouts.id });

    if (!created) throw new Error('Payout insert fail');
    payoutId = created.id;

    // Ledger entry'lere payout_batch_id ata
    for (const id of ids) {
      await tx
        .update(commissionLedger)
        .set({ payoutBatchId: created.id, updatedAt: new Date() })
        .where(eq(commissionLedger.id, id));
    }
  });

  return { ok: true, payoutId, entriesCount: ids.length, netAmountCents: totalNet };
}

export async function approvePayout(
  payoutId: string,
  approvedByUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [p] = await db
    .select({ id: payouts.id, status: payouts.status })
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1);
  if (!p) return { ok: false, error: 'Payout yok' };
  if (p.status !== 'draft') return { ok: false, error: `Payout durumu draft değil: ${p.status}` };

  await db
    .update(payouts)
    .set({
      status: 'approved',
      approvedByUserId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(payouts.id, payoutId));
  return { ok: true };
}

export async function markPayoutPaid(
  payoutId: string,
  externalReference?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [p] = await db
    .select({ id: payouts.id, status: payouts.status, vendorId: payouts.vendorId, netAmountCents: payouts.netAmountCents })
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1);
  if (!p) return { ok: false, error: 'Payout yok' };
  if (p.status !== 'approved' && p.status !== 'processing') {
    return { ok: false, error: `Payout durumu uygun değil: ${p.status}` };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payouts)
      .set({
        status: 'paid',
        paidAt: new Date(),
        externalReference: externalReference ?? null,
        updatedAt: new Date(),
      })
      .where(eq(payouts.id, payoutId));

    // Bu batch'teki ledger entry'lerini paid yap
    await tx
      .update(commissionLedger)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(eq(commissionLedger.payoutBatchId, payoutId));

    // vendor.total_payout_cents artır
    await tx
      .update(vendors)
      .set({
        totalPayoutCents: sql`${vendors.totalPayoutCents} + ${BigInt(p.netAmountCents).toString()}`,
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, p.vendorId));
  });

  return { ok: true };
}
