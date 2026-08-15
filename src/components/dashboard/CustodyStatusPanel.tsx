import {
  deriveCustodyState,
  fetchCustodySummary,
  type CustodyLevel,
  type CustodyState,
  type CustodySummary,
} from '@/lib/kargolab/custody';

/**
 * Zimmet durum paneli — admin dashboard'un en üstünde.
 *
 * Tek soruyu yanıtlar: "bugün çıkmayan sipariş var mı?"
 * KargoLab erişilemezse panel sessizce uyarıya döner, dashboard'ın kalanı çalışmaya devam eder.
 */

const BANNER: Record<CustodyLevel, { wrap: string; icon: string; iconWrap: string; big: string }> = {
  ok: {
    wrap: 'bg-green-50 border-green-300',
    icon: '✓',
    iconWrap: 'bg-green-600 text-white',
    big: 'text-green-700',
  },
  warning: {
    wrap: 'bg-yellow-50 border-yellow-300',
    icon: '!',
    iconWrap: 'bg-yellow-500 text-white',
    big: 'text-yellow-700',
  },
  danger: {
    wrap: 'bg-red-50 border-red-300',
    icon: '!',
    iconWrap: 'bg-red-600 text-white',
    big: 'text-red-700',
  },
  idle: {
    wrap: 'bg-neutral-50 border-neutral-200',
    icon: '—',
    iconWrap: 'bg-neutral-400 text-white',
    big: 'text-neutral-500',
  },
};

function Stat({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  note?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneCls = {
    neutral: 'text-neutral-900',
    good: 'text-green-700',
    warn: 'text-yellow-700',
    bad: 'text-red-700',
  }[tone];
  const borderCls = {
    neutral: 'border-neutral-200',
    good: 'border-neutral-200',
    warn: 'border-yellow-300',
    bad: 'border-red-300',
  }[tone];

  return (
    <div className={`bg-white border ${borderCls} rounded-xl p-4`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-3xl font-bold tabular-nums mt-1 ${toneCls}`}>{value}</div>
      {note && <div className="text-xs text-neutral-500 mt-0.5">{note}</div>}
    </div>
  );
}

function FlowBar({ s, summary }: { s: CustodyState; summary: CustodySummary }) {
  const done = summary.buckets.delivered + summary.buckets.handed_over;
  const transit = summary.buckets.in_transit;
  const segments = [
    { n: done, cls: 'bg-green-500', label: 'Teslim' },
    { n: transit, cls: 'bg-blue-500', label: 'Yolda' },
    { n: s.waitingAtBranch, cls: 'bg-yellow-400', label: 'Zimmette' },
    { n: s.pending, cls: 'bg-red-500', label: 'Bekliyor' },
  ].filter((x) => x.n > 0);

  const total = s.total || 1;

  return (
    <div>
      <div className="flex h-9 rounded-lg overflow-hidden bg-neutral-100">
        {segments.length === 0 ? (
          <div className="w-full flex items-center justify-center text-xs text-neutral-400">
            veri yok
          </div>
        ) : (
          segments.map((x) => (
            <div
              key={x.label}
              className={`${x.cls} flex items-center justify-center text-xs font-bold text-white`}
              style={{ width: `${(x.n / total) * 100}%` }}
              title={`${x.label}: ${x.n}`}
            >
              {x.n / total > 0.08 ? x.n : ''}
            </div>
          ))
        )}
      </div>
      <div className="flex gap-4 flex-wrap mt-2 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Teslim{' '}
          <b className="text-neutral-900">{done}</b>
        </span>
        <span className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Yolda{' '}
          <b className="text-neutral-900">{transit}</b>
        </span>
        <span className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" /> Zimmette bekliyor{' '}
          <b className="text-neutral-900">{s.waitingAtBranch}</b>
        </span>
        <span className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Zimmet bekliyor{' '}
          <b className="text-neutral-900">{s.pending}</b>
        </span>
      </div>
    </div>
  );
}

export default async function CustodyStatusPanel() {
  let summary: CustodySummary;

  try {
    summary = await fetchCustodySummary();
  } catch {
    // KargoLab kapalı/erişilemez — dashboard'ın kalanını düşürme.
    return (
      <section className="mb-8">
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 text-sm text-neutral-600">
          <b className="text-neutral-900">Zimmet durumu şu an alınamıyor.</b> KargoLab bağlantısı
          kurulamadı; birazdan tekrar denenecek. Diğer veriler etkilenmedi.
        </div>
      </section>
    );
  }

  const s = deriveCustodyState(summary);
  const b = BANNER[s.level];

  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-lg font-bold">Zimmet durumu</h2>
        <span className="text-xs text-neutral-500">
          {summary.range.is_today ? 'bugün' : `${summary.range.date_start} – ${summary.range.date_end}`}
          {summary.taken.last_taken_at ? ` · son okutma ${summary.taken.last_taken_at.slice(11, 16)}` : ''}
        </span>
      </div>

      {/* Ana karar bandı */}
      <div className={`border rounded-xl p-5 mb-4 flex items-center gap-4 flex-wrap ${b.wrap}`}>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black flex-none ${b.iconWrap}`}
        >
          {b.icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-neutral-900">{s.title}</h3>
          <p className="text-sm text-neutral-700 mt-0.5">{s.description}</p>
        </div>
        <div className="ml-auto text-right">
          <div className={`text-4xl font-black tabular-nums leading-none ${b.big}`}>
            {s.notDispatched}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mt-1">
            çıkmayan sipariş
          </div>
        </div>
      </div>

      {/* Sayaçlar */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        <Stat label="Bugünkü sipariş" value={s.total} note="toplam iş" />
        <Stat label="Zimmete alınan" value={s.taken} note={s.total ? `%${s.takenPct}` : '—'} />
        <Stat label="Taşıyıcıya geçen" value={s.dispatched} note="yola çıktı" tone="good" />
        <Stat
          label="Şubeye teslim bekleyen"
          value={s.waitingAtBranch}
          note="zimmette, hareket yok"
          tone={s.waitingAtBranch > 0 ? 'warn' : 'neutral'}
        />
        <Stat
          label="Zimmet bekleyen"
          value={s.pending}
          note="anlık — tarihten bağımsız"
          tone={s.pending > 0 ? 'bad' : 'neutral'}
        />
      </div>

      {/* Akış çubuğu */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-4">
        <div className="text-sm font-bold mb-3">Sipariş akışı</div>
        <FlowBar s={s} summary={summary} />
      </div>

      {/* Taşıyıcı kırılımı */}
      {summary.carriers.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <div className="text-sm font-bold mb-3">Taşıyıcı dağılımı</div>
          <div className="flex flex-wrap gap-2">
            {summary.carriers.map((c) => (
              <span
                key={c.courrier_id}
                className="inline-flex items-center gap-2 bg-neutral-100 border border-neutral-200 rounded-full px-3 py-1.5 text-sm"
              >
                <b>{c.display_name || c.courrier_name}</b>
                <span className="tabular-nums text-neutral-600">{c.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {summary.stale.count > 0 && (
        <p className="text-xs text-neutral-500 mt-3">
          {summary.stale.count} gönderinin durumu {summary.stale.threshold_hours} saattir
          değişmedi. Taşıyıcı durumları KargoLab tarafında yaklaşık 15 dakikada bir tazelenir.
        </p>
      )}
    </section>
  );
}
