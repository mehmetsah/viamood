import Link from 'next/link';
import {
  fetchStatementSummary,
  formatTRY,
  type StatementSummary,
} from '@/lib/kargolab/statement';

/**
 * Cari özeti — admin dashboard'unda.
 *
 * Karma model (C7/D2): özet burada, detay KargoLab'de. "Detay" bağlantısı
 * /admin/kargolab-gecis üzerinden gider; jeton orada üretilir, kullanıcı
 * ikinci kez giriş yapmaz.
 *
 * KargoLab erişilemezse panel tek başına uyarıya döner, dashboard çalışır kalır.
 */

function Card({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'neutral' | 'good' | 'bad' | 'warn';
}) {
  const valueCls = {
    neutral: 'text-neutral-900',
    good: 'text-green-700',
    bad: 'text-red-700',
    warn: 'text-yellow-700',
  }[tone];

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${valueCls}`}>{value}</div>
      {note && <div className="text-xs text-neutral-500 mt-0.5">{note}</div>}
    </div>
  );
}

export default async function StatementSummaryPanel() {
  let s: StatementSummary;

  try {
    s = await fetchStatementSummary({ recentLimit: 5 });
  } catch {
    return (
      <section className="mb-8">
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 text-sm text-neutral-600">
          <b className="text-neutral-900">Cari özeti şu an alınamıyor.</b> KargoLab bağlantısı
          kurulamadı; diğer veriler etkilenmedi.
        </div>
      </section>
    );
  }

  const borclu = s.balance.status === 'debtor';

  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-bold">Cari durum</h2>
        <span className="text-xs text-neutral-500">
          {s.period.date_start} – {s.period.date_end}
        </span>
        <Link
          href="/admin/kargolab-gecis?target=statements"
          className="ml-auto text-sm font-semibold text-blue-700 hover:underline"
        >
          Detayı KargoLab&apos;de aç →
        </Link>
      </div>

      <div
        className="grid gap-3 mb-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}
      >
        <Card
          label="Bakiye"
          value={formatTRY(s.balance.amount)}
          note={borclu ? 'borçlu' : s.balance.status === 'creditor' ? 'alacaklı' : 'kapalı'}
          tone={borclu ? 'bad' : s.balance.status === 'creditor' ? 'good' : 'neutral'}
        />
        <Card label="Bu dönem çıkan" value={formatTRY(s.period.out)} note={`${s.period.count} hareket`} />
        <Card label="Bu dönem giren" value={formatTRY(s.period.in)} tone="good" />
        <Card
          label="Bekleyen tahsilat"
          value={formatTRY(s.cod_pending.net_amount)}
          note={
            s.cod_pending.count > 0
              ? `${s.cod_pending.count} gönderi${s.cod_pending.estimate_scope === 'none' ? ' (brüt)' : ''}`
              : 'yok'
          }
          tone={s.cod_pending.net_amount > 0 ? 'good' : 'neutral'}
        />
      </div>

      {s.recent.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 text-sm font-bold">
            Son hareketler
          </div>
          <table className="w-full text-sm">
            <tbody>
              {s.recent.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">{r.date}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        r.direction === 'in'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {r.direction === 'in' ? 'Giriş' : 'Çıkış'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {r.description || r.category || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap">
                    {r.direction === 'in' ? '+' : '−'}
                    {formatTRY(r.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500 whitespace-nowrap">
                    {formatTRY(r.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
