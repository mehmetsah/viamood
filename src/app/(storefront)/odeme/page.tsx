import { getStoreSettings } from '@/lib/settings/store';
import { isHalkodePreview } from '@/lib/halkode/preview';
import { CheckoutForm } from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const settings = await getStoreSettings();

  // Gizli önizleme (yalnız ?halkode=1 çerezi olan kişi): kart gateway'i BU İSTEK için
  // Halköde kabul edilir. DB'deki ayarlar DEĞİŞMEZ — normal müşteri bugünkü akışı görür.
  // Test modu zorlanır; bu yoldan canlı POS'a gidilmesi mümkün değildir (client.ts cfg()).
  const preview = await isHalkodePreview();
  const payment = preview
    ? { ...settings.payment, card_gateway: 'halkode' as const, halkode_enabled: true, halkode_test_mode: 1 }
    : settings.payment;

  return (
    <div className="emp">
      <div className="emp-wrap" style={{ maxWidth: 960, paddingBlock: 'clamp(28px,4vw,48px)' }}>
        <h1 style={{ fontSize: 'clamp(1.5rem,2.6vw,2rem)', fontWeight: 700, margin: '0 0 24px', letterSpacing: '-.015em' }}>Ödeme</h1>
        <CheckoutForm payment={payment} />
      </div>
    </div>
  );
}
