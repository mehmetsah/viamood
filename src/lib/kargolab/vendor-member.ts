import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { vendors } from '@/db/schema';
import { logAudit } from '@/lib/audit/logger';
import { createTenantMember, isTenantConfigured, TenantNotConfiguredError } from './tenant';

/**
 * Tedarikçi → KargoLab üyesi (Via Mood tenant'ında).
 *
 * Tedarikçi onaylandığı anda, Via Mood'un kendi tenant'ında (kargo.viamood.com.tr)
 * ayrı bir üye açılır. Üye numarası `vendors.kargolabMemberId` alanında saklanır;
 * tedarikçi panelindeki kargo/cari bölümü bu numaraya dayanır.
 *
 * ⚠️ Best-effort: KargoLab erişilemezse tedarikçi onayı GERİ ALINMAZ. Hata
 *    `kargolabSyncError` alanına yazılır ve admin panelinden yeniden denenebilir —
 *    onay akışını dış servise bağımlı kılmak, KargoLab kısa süre erişilemez olduğunda
 *    tedarikçi kaydını bloke ederdi.
 */
export async function createKargoLabMemberForVendor(vendorId: string): Promise<number | null> {
  if (!isTenantConfigured()) {
    // Yapılandırma yoksa sessizce geç — kurulum tamamlanınca yeniden denenir.
    return null;
  }

  const [v] = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      legalName: vendors.legalName,
      email: vendors.email,
      phone: vendors.phone,
      taxId: vendors.taxId,
      taxOffice: vendors.taxOffice,
      city: vendors.city,
      district: vendors.district,
      addressLine1: vendors.addressLine1,
      kargolabMemberId: vendors.kargolabMemberId,
      kargolabEnabled: vendors.kargolabEnabled,
    })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!v) return null;

  // Zaten açılmışsa tekrar açma — çift üye, çift cari demektir.
  if (v.kargolabMemberId) return v.kargolabMemberId;

  // ⚠️ Üye yalnız "KargoLab ile çalışacak" işaretli tedarikçi için açılır.
  //    Bu kontrol action'da da var; burada ikinci kez bakılıyor çünkü servis
  //    ileride başka bir yerden (toplu işlem, cron) çağrılabilir ve o çağrı
  //    anahtarı kontrol etmeyi unutursa boş cari hesap açılırdı.
  if (!v.kargolabEnabled) return null;

  try {
    const { memberId } = await createTenantMember({
      companyName: v.legalName || v.name,
      email: v.email,
      phone: v.phone ?? undefined,
      taxId: v.taxId ?? undefined,
      taxOffice: v.taxOffice ?? undefined,
      city: v.city ?? undefined,
      district: v.district ?? undefined,
      addressLine1: v.addressLine1 ?? undefined,
    });

    await db
      .update(vendors)
      .set({
        kargolabMemberId: memberId,
        kargolabSyncedAt: new Date(),
        kargolabSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId));

    await logAudit({
      actorType: 'system',
      action: 'vendor.kargolab_member.create',
      entityType: 'vendor',
      entityId: vendorId,
      metadata: { kargolabMemberId: memberId },
    });

    return memberId;
  } catch (err) {
    const message =
      err instanceof TenantNotConfiguredError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Bilinmeyen hata';

    await db
      .update(vendors)
      .set({ kargolabSyncError: message, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId));

    await logAudit({
      actorType: 'system',
      action: 'vendor.kargolab_member.error',
      entityType: 'vendor',
      entityId: vendorId,
      metadata: { error: message },
    });

    return null;
  }
}
