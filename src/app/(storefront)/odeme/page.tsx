import { getStoreSettings } from '@/lib/settings/store';
import { CheckoutForm } from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const settings = await getStoreSettings();
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Ödeme</h1>
      <CheckoutForm payment={settings.payment} />
    </div>
  );
}
