import { AiShipmentClient } from './AiShipmentClient';

export const metadata = {
  title: 'AI Kargo Oluşturma — Via Mood Vendor',
};

export default function AiShipmentPage() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold mb-2">📦 AI ile Kargo Oluştur</h1>
        <p className="text-sm text-neutral-600 max-w-2xl">
          WhatsApp veya Instagram yazışmasını yapıştır — Claude AI içinden alıcı adı,
          telefon, adres ve ürün bilgisini otomatik çıkarsın. Sonra düzelt + KargoLab&apos;a
          yolla.
        </p>
      </header>
      <AiShipmentClient />
    </div>
  );
}
