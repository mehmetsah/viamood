import Link from 'next/link';
import { generateStockReport } from '@/lib/server/mikro-stock-validator';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function MikroAdminPage() {
  const report = await generateStockReport();
  const matchPct = report.dbTotal > 0 ? Math.round((report.matchedCount / report.dbTotal) * 100) : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/admin" className="text-sm text-neutral-600 hover:underline">← Dashboard</Link>
      <h1 className="text-3xl font-bold mt-2 mb-2">Mikro V17 Entegrasyon</h1>
      <p className="text-sm text-neutral-600 mb-8">
        Mikro stoğu (Yunus 2026-05-21) ile bizim DB&apos;deki ürün SKU&apos;larının eşleşmesi.
        Eşleşmeyenler Mikro&apos;ya sipariş aktarılamaz.
      </p>

      {/* Bağlantı / config */}
      <section className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="font-bold mb-4 text-sm">Konfigürasyon</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Stat label="API URL" value={env.MIKRO_API_URL ? '✓ tanımlı' : '✗ eksik'} />
          <Stat label="Stok prefix" value={env.MIKRO_STOK_PREFIX} mono />
          <Stat label="Cari prefix" value={env.MIKRO_CARI_PREFIX} mono />
          <Stat label="Cari seed" value={String(env.MIKRO_CARI_SEED)} mono />
          <Stat label="Onaylayan user" value={String(env.MIKRO_APPROVER_USER_NO)} mono />
          <Stat label="Proje kodu" value={env.MIKRO_PROJE_KODU} mono />
          <Stat label="Depo no" value={String(env.MIKRO_DEPO_NO)} mono />
          <Stat label="Auto-push" value={env.MIKRO_AUTO_PUSH ? '✓ açık' : '✗ kapalı'} />
        </div>
      </section>

      {/* Özet */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <BigStat label="Mikro stok" value={report.mikroTotal} />
        <BigStat label="DB variant" value={report.dbTotal} />
        <BigStat label="Eşleşen" value={report.matchedCount} positive />
        <BigStat label="Eksik (Mikro&apos;da yok)" value={report.missing.length} negative={report.missing.length > 0} />
      </section>

      {/* Eşleşme yüzdesi */}
      <section className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-neutral-600">Eşleşme oranı</span>
          <span className="font-bold">%{matchPct}</span>
        </div>
        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${matchPct === 100 ? 'bg-green-500' : matchPct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${matchPct}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          %100&apos;e ulaşana kadar Mikro&apos;da olmayan SKU&apos;ları Yunus&apos;a iletmen gerekir; aksi halde o ürünleri içeren siparişler Mikro&apos;ya aktarılmaz.
        </p>
      </section>

      {/* Eksik SKU'lar */}
      {report.missing.length > 0 && (
        <section className="bg-white rounded-xl border border-red-200 overflow-hidden mb-6">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
            <h3 className="font-bold text-red-800 text-sm">
              ⚠ Mikro&apos;da Olmayan {report.missing.length} SKU
            </h3>
            <span className="text-xs text-red-700">Yunus&apos;a iletilmeli</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-neutral-500 bg-neutral-50">
              <tr>
                <th className="text-left px-4 py-2">Ürün</th>
                <th className="text-left px-4 py-2">Vendor</th>
                <th className="text-left px-4 py-2">Bizim SKU</th>
                <th className="text-left px-4 py-2">Mikro stok kodu (üretilen)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.missing.slice(0, 100).map((m) => (
                <tr key={m.variantId}>
                  <td className="px-4 py-2">{m.productTitle}</td>
                  <td className="px-4 py-2 text-xs text-neutral-600">{m.vendorName ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.sku}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.stokKoduMikro}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.missing.length > 100 && (
            <p className="p-3 text-xs text-neutral-500 border-t">
              Toplam {report.missing.length} eksik — ilk 100 gösterildi
            </p>
          )}
        </section>
      )}

      {/* Mikro'da olup DB'de olmayan */}
      {report.unusedInDb.length > 0 && (
        <details className="bg-white rounded-xl border p-6 mb-6">
          <summary className="font-bold text-sm cursor-pointer">
            Mikro&apos;da var ama DB&apos;de yok — {report.unusedInDb.length} adet
            <span className="ml-2 text-xs text-neutral-500 font-normal">
              (referans için, bu ürünler henüz Via Mood&apos;a eklenmemiş)
            </span>
          </summary>
          <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {report.unusedInDb.slice(0, 50).map((s) => (
              <li key={s.sku} className="font-mono">
                <span className="text-neutral-500">VIA{s.sku}</span>{' '}
                <span className="text-neutral-700">{s.name.slice(0, 60)}</span>
              </li>
            ))}
          </ul>
          {report.unusedInDb.length > 50 && (
            <p className="mt-3 text-xs text-neutral-500">… ve {report.unusedInDb.length - 50} adet daha</p>
          )}
        </details>
      )}

      {/* Yunus kuralları */}
      <section className="bg-neutral-50 border rounded-xl p-6 text-sm">
        <h3 className="font-bold mb-2">Yunus&apos;un kuralları (2026-05-21)</h3>
        <ul className="space-y-1 text-neutral-700">
          <li>✓ Ara depoya sevkiyat için stok kodunun başına <code className="bg-white px-1 rounded">VIA</code> eklenir</li>
          <li>✓ Tüm stoklar Mikro&apos;da kayıtlı olmalı — olmayan stoklar sipariş aktarımında fail eder</li>
          <li>✓ Mevcut SKU&apos;lar WooCommerce ile birebir aynı (282 stok)</li>
          <li>✓ Cari seed = <code className="bg-white px-1 rounded">10000</code> (son cari E3801)</li>
          <li>✓ Onaylayan Mikro user no = <code className="bg-white px-1 rounded">1</code> (şimdilik)</li>
          <li>⏳ Birim maliyetler — Yunus Mikro desteğine yazdı, dönüş bekleniyor</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">{label}</div>
      <div className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</div>
    </div>
  );
}

function BigStat({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
}) {
  const cls = positive
    ? 'bg-green-50 border-green-200 text-green-900'
    : negative
      ? 'bg-red-50 border-red-200 text-red-900'
      : 'bg-white border-neutral-200';
  return (
    <div className={`border rounded-xl p-5 ${cls}`}>
      <div className="text-xs uppercase tracking-wider opacity-70 mb-2">{label}</div>
      <div className="text-3xl font-bold">{value.toLocaleString('tr-TR')}</div>
    </div>
  );
}
