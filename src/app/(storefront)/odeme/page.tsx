import { getStoreSettings, vitrinOdemeAyarlari } from '@/lib/settings/store';
import { halkodeOnizlemeOrtami } from '@/lib/halkode/preview';
import { CheckoutForm } from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const settings = await getStoreSettings();

  // Gizli önizleme (yalnız ?halkode=1 çerezi olan kişi): kart gateway'i BU İSTEK için
  // Halköde kabul edilir. DB'deki ayarlar DEĞİŞMEZ — normal müşteri bugünkü akışı görür.
  // Test modu zorlanır; bu yoldan canlı POS'a gidilmesi mümkün değildir (client.ts cfg()).
  //
  // ⚠️ YALNIZ 'test' ÖNİZLEMESİ — 'canli' çerezi buraya BİLEREK geçmez. Geçseydi
  // canlı deneme linkini açan kişi sonra /odeme'ye uğradığında GERÇEK sipariş
  // akışını (draft + RDS kaydı) canlı POS'a bağlamış olurdu: küçük bir deneme
  // linki, farkında olmadan gerçek bir satış hattına dönüşürdü. Canlı deneme
  // kendi ayrı sayfasında kalır.
  //
  // ⚠️ İSTEMCİYE YALNIZ BEYAZ LİSTE GİDER (vitrinOdemeAyarlari). Buraya
  // `settings.payment` olduğu gibi verilirse PayTR/İyzico/Halköde SIRLARI
  // sayfanın RSC yüküyle birlikte herkese açık HTML'e gömülür — 17 Eyl 2026'da
  // tam olarak bu oluyordu ve `curl https://…/odeme` ile okunabiliyordu.
  const preview = (await halkodeOnizlemeOrtami()) === 'test';
  const payment = vitrinOdemeAyarlari(
    preview
      ? { ...settings.payment, card_gateway: 'halkode' as const, halkode_enabled: true, halkode_test_mode: 1 }
      : settings.payment,
  );

  return (
    <div className="emp">
      <div className="emp-wrap" style={{ maxWidth: 960, paddingBlock: 'clamp(28px,4vw,48px)' }}>
        <h1 style={{ fontSize: 'clamp(1.5rem,2.6vw,2rem)', fontWeight: 700, margin: '0 0 24px', letterSpacing: '-.015em' }}>Ödeme</h1>
        <CheckoutForm payment={payment} />
      </div>
    </div>
  );
}
