import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
import { ProfileForm } from './ProfileForm';

export default async function VendorProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  const [row] = await db
    .select({ vendor: vendors })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!row) redirect('/onboarding');
  const v = row.vendor;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Profilim</h1>
      <p className="text-neutral-600 text-sm mb-8">
        Mağaza, iletişim ve banka bilgilerini buradan yönet. Vergi numarası gibi yasal bilgiler
        admin'den onayla değişir.
      </p>

      <ProfileForm
        defaults={{
          name: v.name,
          description: v.description ?? '',
          email: v.email,
          phone: v.phone ?? '',
          website: v.website ?? '',
          addressLine1: v.addressLine1 ?? '',
          addressLine2: v.addressLine2 ?? '',
          city: v.city ?? '',
          district: v.district ?? '',
          postalCode: v.postalCode ?? '',
          iban: v.iban ?? '',
          accountHolderName: v.accountHolderName ?? '',
          bankName: v.bankName ?? '',
          taxId: v.taxId ?? '',
          taxOffice: v.taxOffice ?? '',
        }}
      />
    </div>
  );
}
