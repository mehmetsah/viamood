import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customerAddresses } from '@/db/schema';
import { getSessionCustomer } from '@/lib/customers/session';
import { AddressBook, type AddressDTO } from './AddressBook';

export const dynamic = 'force-dynamic';

export default async function AdreslerPage() {
  const customer = await getSessionCustomer();
  const rows = customer
    ? await db
        .select()
        .from(customerAddresses)
        .where(eq(customerAddresses.customerId, customer.id))
        .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt))
    : [];

  const addresses: AddressDTO[] = rows.map((r) => ({
    id: r.id,
    label: r.label,
    firstName: r.firstName,
    lastName: r.lastName,
    phone: r.phone,
    province: r.province,
    district: r.district,
    neighborhood: r.neighborhood,
    address1: r.address1,
    postalCode: r.postalCode,
    isDefault: r.isDefault,
  }));

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Adreslerim</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Kaydettiğin adresler checkout&apos;ta otomatik dolar (il/ilçe/mahalle dahil)
      </p>
      <AddressBook addresses={addresses} />
    </div>
  );
}
