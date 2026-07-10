import { getSessionCustomer } from '@/lib/customers/session';
import { ProfileForms } from './ProfileForms';

export const dynamic = 'force-dynamic';

export default async function ProfilPage() {
  const customer = await getSessionCustomer();

  return (
    <>
      <div className="vh-baslik">
        <h1>Profilim</h1>
        <p>Hesap bilgilerin ve tercihlerin</p>
      </div>
      <ProfileForms
        initialName={customer?.name ?? ''}
        initialPhone={customer?.phone ?? ''}
        email={customer?.email ?? ''}
        initialPrefs={customer?.preferences ?? {}}
      />
    </>
  );
}
