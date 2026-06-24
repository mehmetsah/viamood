import { getSessionCustomer } from '@/lib/customers/session';
import { ProfileForms } from './ProfileForms';

export const dynamic = 'force-dynamic';

export default async function ProfilPage() {
  const customer = await getSessionCustomer();

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Profil</h1>
      <p className="text-sm text-neutral-500 mb-6">Hesap bilgilerin ve şifren</p>
      <ProfileForms
        initialName={customer?.name ?? ''}
        initialPhone={customer?.phone ?? ''}
        email={customer?.email ?? ''}
      />
    </div>
  );
}
