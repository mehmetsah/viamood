import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customerAddresses } from '@/db/schema';
import { getSessionCustomer } from '@/lib/customers/session';
import { AddressBook, type AddressDTO } from './AddressBook';
import { Pagination, parsePage } from '../_components/Pagination';

export const dynamic = 'force-dynamic';

const PAGE = 9;

export default async function AdreslerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp);
  const customer = await getSessionCustomer();

  const [toplam, rows] = customer
    ? await Promise.all([
        db
          .select({ n: count() })
          .from(customerAddresses)
          .where(eq(customerAddresses.customerId, customer.id))
          .then((r) => r[0]?.n ?? 0),
        db
          .select()
          .from(customerAddresses)
          .where(eq(customerAddresses.customerId, customer.id))
          .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt))
          .limit(PAGE)
          .offset((page - 1) * PAGE),
      ])
    : [0, []];

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
    <>
      <div className="vh-baslik">
        <h1>Adreslerim</h1>
        <p>{toplam > 0 ? `${toplam} kayıtlı adres` : 'Kayıtlı adresin yok'}</p>
      </div>
      <AddressBook addresses={addresses} />
      <Pagination total={toplam} page={page} pageSize={PAGE} basePath="/hesabim/adresler" />
    </>
  );
}
