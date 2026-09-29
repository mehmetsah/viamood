import { getStoreSettings } from '@/lib/settings/store';
import { CheckoutForm } from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const settings = await getStoreSettings();
  return (
    <div className="emp">
      <div className="emp-wrap" style={{ maxWidth: 960, paddingBlock: 'clamp(28px,4vw,48px)' }}>
        <h1 style={{ fontSize: 'clamp(1.5rem,2.6vw,2rem)', fontWeight: 700, margin: '0 0 24px', letterSpacing: '-.015em' }}>Ödeme</h1>
        <CheckoutForm payment={settings.payment} />
      </div>
    </div>
  );
}
