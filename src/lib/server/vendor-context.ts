/**
 * Vendor context resolver — server actions ve server components'ta kullanılır.
 * Login olan kullanıcının yetkili olduğu vendor'ı bulur (ilk membership).
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';

export type VendorRole = 'owner' | 'manager' | 'staff' | 'viewer';

export interface VendorContext {
  userId: string;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  vendorStatus: 'pending' | 'active' | 'suspended' | 'rejected' | 'archived';
  role: VendorRole;
}

export class NoVendorAccess extends Error {
  constructor(message = 'Vendor erişimi yok') {
    super(message);
    this.name = 'NoVendorAccess';
  }
}

export async function requireVendor(): Promise<VendorContext> {
  const session = await auth();
  if (!session?.user?.id) throw new NoVendorAccess('Giriş yapılmamış');

  const [row] = await db
    .select({
      vendorId: vendors.id,
      vendorName: vendors.name,
      vendorSlug: vendors.slug,
      vendorStatus: vendors.status,
      role: vendorMemberships.role,
    })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!row) throw new NoVendorAccess('Tedarikçi profili yok');

  return {
    userId: session.user.id,
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    vendorSlug: row.vendorSlug,
    vendorStatus: row.vendorStatus,
    role: row.role as VendorRole,
  };
}

export async function requireActiveVendor(): Promise<VendorContext> {
  const ctx = await requireVendor();
  if (ctx.vendorStatus !== 'active') {
    throw new NoVendorAccess(`Vendor durumu '${ctx.vendorStatus}' — aktif olunca işlem yapabilirsin`);
  }
  return ctx;
}

export function canEdit(role: VendorRole): boolean {
  return role === 'owner' || role === 'manager';
}
