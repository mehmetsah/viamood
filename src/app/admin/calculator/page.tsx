import Link from 'next/link';
import { CalculatorClient } from './CalculatorClient';

export default function CalculatorPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin" className="text-sm text-neutral-600 hover:underline">← Dashboard</Link>
      <h1 className="text-3xl font-bold mt-2 mb-2">Satış Fiyatı Hesap Makinesi</h1>
      <p className="text-sm text-neutral-600 mb-8">
        Ersin&apos;in MoodDepo modeli — Trendyol ve Instagram/PTT için KDVsiz kâr hesabı.
        <br />
        <strong>Kâr % = (Net kâr / Alış KDVsiz) × 100</strong> — satış değil, alış üzerinden hesaplanır.
      </p>
      <CalculatorClient />
    </div>
  );
}
