'use server';

/**
 * FAZ 2 — Trendyol bağlantı aksiyonları (admin).
 * Vendor'ın Trendyol mağazasını bağlar (şifreli saklar) + bağlantıyı test eder.
 * Kredensiyel düz metin DÖNMEZ; sipariş/ürün canlı akışına dokunmaz.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auditUser } from '@/lib/audit/logger';
import { auth } from '@/lib/auth';
import { saveTrendyolConnection, testTrendyolConnection } from '@/lib/trendyol/integration';
import type { TrendyolTestResult } from '@/lib/trendyol/integration';
import type { ActionResult } from './auth';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin')) {
    throw new Error('Unauthorized: admin yetkisi gerekli');
  }
  return session.user;
}

const connectSchema = z.object({
  vendorId: z.string().uuid('Geçersiz tedarikçi'),
  supplierId: z.string().trim().min(1, 'Satıcı ID (supplierId) gerekli'),
  apiKey: z.string().trim().min(1, 'API Key gerekli'),
  secretKey: z.string().trim().min(1, 'API Secret gerekli'),
});

/** Trendyol bağlantısını kaydeder/günceller (useActionState uyumlu). */
export async function connectTrendyolAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAdmin();

  const parsed = connectSchema.safeParse({
    vendorId: String(formData.get('vendorId') ?? ''),
    supplierId: String(formData.get('supplierId') ?? ''),
    apiKey: String(formData.get('apiKey') ?? ''),
    secretKey: String(formData.get('secretKey') ?? ''),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] = issue.message;
    return { success: false, error: 'Lütfen formu kontrol et', fieldErrors };
  }

  await saveTrendyolConnection({ ...parsed.data, userId: user.id });

  // Kredensiyel audit'e YAZILMAZ; sadece hangi vendor + supplier bağlandı.
  await auditUser(user.id, 'trendyol.connect', 'vendor_integration', parsed.data.vendorId, {
    note: `Trendyol bağlandı (supplierId=${parsed.data.supplierId})`,
  });

  revalidatePath('/admin/entegrasyonlar');
  return { success: true };
}

/** Bağlantıyı canlı test eder; sonucu (örnek + sayı) döner. */
export async function testTrendyolAction(vendorId: string): Promise<TrendyolTestResult> {
  const user = await requireAdmin();
  if (!z.string().uuid().safeParse(vendorId).success) {
    return { ok: false, productCount: 0, sample: [], error: 'Geçersiz tedarikçi' };
  }

  const result = await testTrendyolConnection(vendorId);

  await auditUser(user.id, 'trendyol.test', 'vendor_integration', vendorId, {
    note: result.ok ? `Test OK (${result.productCount} ürün)` : `Test hata: ${result.error}`,
  });

  revalidatePath('/admin/entegrasyonlar');
  return result;
}
