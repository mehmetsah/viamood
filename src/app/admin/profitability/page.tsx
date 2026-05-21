import Link from 'next/link';
import { buildProfitabilityReport, type VariantRow } from '@/lib/server/profitability-report';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ tier?: string; channel?: string }>;
}

function fmtTL(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}
function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(1) + '%';
}

export default async function ProfitabilityPage({ searchParams }: PageProps) {
  const { tier, channel } = await searchParams;
  const r = await buildProfitabilityReport();

  // Filter
  let filtered = r.rows;
  if (tier && ['profitable', 'warning', 'loss', 'missing'].includes(tier)) {
    if (tier === 'missing') {
      filtered = filtered.filter((x) => x.purchaseExclVat === 0);
    } else {
      filtered = filtered.filter((x) => {
        const t = channel === 'instagram' ? x.instagramTier :
                  channel === 'trendyol' ? x.trendyolTier :
                  (x.bestChannel === 'trendyol' ? x.trendyolTier : x.instagramTier);
        return t === tier;
      });
    }
  }

  // Top performers — en yüksek bestProfitTl
  const topPerformers = [...r.rows]
    .filter((x) => x.bestProfitTl != null && x.bestProfitTl > 0)
    .sort((a, b) => (b.bestProfitTl ?? 0) - (a.bestProfitTl ?? 0))
    .slice(0, 10);

  const underPerformers = [...r.rows]
    .filter((x) =>
      (x.trendyolTier === 'warning' || x.trendyolTier === 'loss') ||
      (x.instagramTier === 'warning' || x.instagramTier === 'loss'),
    )
    .sort((a, b) => {
      const aP = Math.min(a.trendyolProfitPct ?? 999, a.instagramProfitPct ?? 999);
      const bP = Math.min(b.trendyolProfitPct ?? 999, b.instagramProfitPct ?? 999);
      return aP - bP;
    })
    .slice(0, 10);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin" className="text-sm text-neutral-600 hover:underline">← Dashboard</Link>
      <div className="flex items-center justify-between mt-2 mb-2">
        <h1 className="text-3xl font-bold">Kârlılık Raporu</h1>
        <a
          href="/api/admin/profitability/export"
          className="px-5 py-2.5 bg-green-700 text-white rounded-full font-semibold text-sm hover:bg-green-800"
        >
          📊 Excel İndir
        </a>
      </div>
      <p className="text-sm text-neutral-600 mb-8">
        Ersin&apos;in MoodDepo modeline göre Trendyol + Instagram kâr analizi.
        Tüm variantların ürün ekranındaki <strong>Fiyat & Kâr Hesabı</strong> verisinden hesaplanır.
      </p>

      {/* Üst stat kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Toplam variant" value={r.totalVariants} />
        <StatCard label="Pricing girilmiş" value={r.withPricing} subtitle={`${r.withoutPricing} eksik`} />
        <StatCard label="Trendyol ort. kâr" value={fmtPct(r.averageTrendyolPct)} mono />
        <StatCard label="Instagram ort. kâr" value={fmtPct(r.averageInstagramPct)} mono />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Kârlı (%25+)" value={r.countProfitable} kind="green" />
        <StatCard label="Dikkat (%15-25)" value={r.countWarning} kind="yellow" />
        <StatCard label="Zarar (<%15)" value={r.countLoss} kind="red" />
        <StatCard label="Stok değeri" value={fmtTL(r.totalStockValueTl)} mono />
      </div>

      {/* Ek istatistikler */}
      <section className="bg-white rounded-xl border p-5 mb-8">
        <h3 className="font-bold mb-3 text-sm">Ortalama Maliyet Kalemleri</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <Mini label="Ort. kargo" value={fmtTL(r.averageKargoTl)} />
          <Mini label="Ort. komisyon" value={fmtTL(r.averageCommissionTl)} />
          <Mini label="Ort. reklam (reklam olan)" value={fmtTL(r.averageAdvertisingTl)} />
        </div>
      </section>

      {/* Top performers */}
      {topPerformers.length > 0 && (
        <section className="bg-white rounded-xl border mb-8 overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-200">
            <h3 className="font-bold text-green-900 text-sm">🏆 En Kârlı 10 Ürün</h3>
          </div>
          <PerformerTable rows={topPerformers} />
        </section>
      )}

      {/* Under performers */}
      {underPerformers.length > 0 && (
        <section className="bg-white rounded-xl border border-red-200 mb-8 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <h3 className="font-bold text-red-900 text-sm">⚠ Dikkat / Zararlı 10 Ürün</h3>
          </div>
          <PerformerTable rows={underPerformers} />
        </section>
      )}

      {/* Full table */}
      <section className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-neutral-50 border-b flex items-center justify-between">
          <h3 className="font-bold text-sm">Tüm Variantlar ({filtered.length})</h3>
          <div className="flex gap-2 text-xs">
            <FilterLink current={tier} value={undefined} label="Tümü" />
            <FilterLink current={tier} value="profitable" label="Kârlı" />
            <FilterLink current={tier} value="warning" label="Dikkat" />
            <FilterLink current={tier} value="loss" label="Zararlı" />
            <FilterLink current={tier} value="missing" label="Pricing eksik" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-100">
              <tr>
                <th className="text-left px-3 py-2">Ürün</th>
                <th className="text-left px-3 py-2">Vendor</th>
                <th className="text-right px-3 py-2">Alış KDVsiz</th>
                <th className="text-right px-3 py-2">Desi</th>
                <th className="text-right px-3 py-2">Trendyol</th>
                <th className="text-right px-3 py-2">TY Kâr %</th>
                <th className="text-right px-3 py-2">Instagram</th>
                <th className="text-right px-3 py-2">IG Kâr %</th>
                <th className="text-right px-3 py-2">Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.slice(0, 200).map((row) => (
                <tr key={row.variantId} className="hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{row.productTitle}</div>
                    <div className="text-neutral-500 font-mono">{row.sku ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{row.vendorName}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtTL(row.purchaseExclVat || null)}</td>
                  <td className="px-3 py-2 text-right">{row.config.desi ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtTL(row.trendyolPrice)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${tierTextClass(row.trendyolTier)}`}>
                    {fmtPct(row.trendyolProfitPct)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtTL(row.instagramPrice)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${tierTextClass(row.instagramTier)}`}>
                    {fmtPct(row.instagramProfitPct)}
                  </td>
                  <td className="px-3 py-2 text-right">{row.available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 && (
          <p className="px-4 py-3 text-xs text-neutral-500 border-t">
            İlk 200 gösterildi. Tamamı için Excel indir.
          </p>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label, value, subtitle, kind, mono,
}: { label: string; value: number | string; subtitle?: string; kind?: 'green' | 'yellow' | 'red'; mono?: boolean }) {
  const cls = kind === 'green' ? 'bg-green-50 border-green-200 text-green-900' :
              kind === 'yellow' ? 'bg-yellow-50 border-yellow-200 text-yellow-900' :
              kind === 'red' ? 'bg-red-50 border-red-200 text-red-900' :
              'bg-white border-neutral-200';
  return (
    <div className={`border rounded-xl p-5 ${cls}`}>
      <div className="text-xs uppercase tracking-wider opacity-70 mb-2">{label}</div>
      <div className={`text-2xl font-bold ${mono ? 'font-mono' : ''}`}>{value}</div>
      {subtitle && <div className="text-xs opacity-60 mt-1">{subtitle}</div>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="font-mono font-semibold mt-1">{value}</div>
    </div>
  );
}

function FilterLink({ current, value, label }: { current?: string; value?: string; label: string }) {
  const active = current === value || (!current && !value);
  const href = value ? `?tier=${value}` : '?';
  return (
    <Link
      href={href}
      className={`px-2 py-1 rounded ${active ? 'bg-[var(--color-brand-ink)] text-white' : 'bg-white border hover:bg-neutral-50'}`}
    >
      {label}
    </Link>
  );
}

function PerformerTable({ rows }: { rows: VariantRow[] }) {
  return (
    <table className="w-full text-xs">
      <tbody className="divide-y">
        {rows.map((row) => {
          const bestPct = row.bestChannel === 'trendyol' ? row.trendyolProfitPct : row.instagramProfitPct;
          const tier = row.bestChannel === 'trendyol' ? row.trendyolTier : row.instagramTier;
          return (
            <tr key={row.variantId}>
              <td className="px-3 py-2">
                <div className="font-semibold">{row.productTitle}</div>
                <div className="text-neutral-500 font-mono">{row.sku ?? '—'}</div>
              </td>
              <td className="px-3 py-2 text-neutral-600">{row.vendorName}</td>
              <td className="px-3 py-2 text-right text-xs uppercase tracking-wider text-neutral-500">{row.bestChannel ?? '—'}</td>
              <td className={`px-3 py-2 text-right font-mono font-bold ${tierTextClass(tier)}`}>{fmtPct(bestPct)}</td>
              <td className="px-3 py-2 text-right font-mono">{fmtTL(row.bestProfitTl)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function tierTextClass(t: string | null | undefined): string {
  if (t === 'profitable') return 'text-green-700';
  if (t === 'warning') return 'text-yellow-700';
  if (t === 'loss') return 'text-red-700';
  return 'text-neutral-400';
}
