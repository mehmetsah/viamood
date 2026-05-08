import { asc } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { routingRules } from '@/db/schema';
import {
  deleteRoutingRuleAction,
  toggleRoutingRuleAction,
} from '@/lib/actions/routing';

const MODE_LABELS = {
  split: { label: 'Split', cls: 'bg-blue-100 text-blue-900' },
  consolidate_self: { label: 'Consolidate (biz)', cls: 'bg-purple-100 text-purple-900' },
  consolidate_carrier: { label: 'Consolidate (kargocu)', cls: 'bg-pink-100 text-pink-900' },
};

export default async function RoutingRulesPage() {
  const rules = await db.select().from(routingRules).orderBy(asc(routingRules.priority));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Sipariş Yönlendirme Kuralları</h1>
          <p className="text-neutral-600 text-sm mt-1">
            Çok-vendor siparişlerin nasıl bölüneceğini/birleştirileceğini belirler. Priority sırasıyla
            değerlendirilir, ilk eşleşen uygulanır.
          </p>
        </div>
        <Link
          href="/admin/routing-rules/new"
          className="px-5 py-2.5 bg-[var(--color-brand-ink)] text-white rounded-full font-semibold text-sm"
        >
          + Yeni Kural
        </Link>
      </div>

      {rules.length === 0 ? (
        <div className="bg-white rounded-xl p-16 border text-center">
          <div className="text-5xl mb-3">🔀</div>
          <h2 className="font-bold mb-2">Henüz kural yok</h2>
          <p className="text-neutral-600 text-sm mb-6">
            Kural eklemezsen tüm çok-vendor siparişler default olarak <strong>SPLIT</strong>'e gider
            (her vendor kendi paketini gönderir).
          </p>
          <Link
            href="/admin/routing-rules/new"
            className="inline-flex px-5 py-2.5 bg-[var(--color-brand-ink)] text-white rounded-full font-semibold text-sm"
          >
            + İlk kuralı ekle
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => {
            const mode = MODE_LABELS[r.action];
            return (
              <div
                key={r.id}
                className={`bg-white rounded-xl border p-5 ${!r.enabled ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl font-mono font-bold text-neutral-400 w-12 text-center">
                    {r.priority}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold">{r.name}</h3>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${mode.cls}`}>
                        {mode.label}
                      </span>
                      {!r.enabled && (
                        <span className="text-xs font-bold px-2 py-1 rounded bg-neutral-200 text-neutral-700">
                          Kapalı
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="text-sm text-neutral-600 mb-2">{r.description}</p>
                    )}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-neutral-500 hover:text-neutral-800">
                        Koşulları göster
                      </summary>
                      <pre className="mt-2 p-3 bg-neutral-50 rounded font-mono text-xs overflow-auto">
                        {JSON.stringify(r.conditions, null, 2)}
                      </pre>
                    </details>
                    <div className="text-xs text-neutral-400 mt-2">
                      Eşleşme: {r.timesMatched.toString()}x
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    <Link
                      href={`/admin/routing-rules/${r.id}`}
                      className="px-3 py-1.5 border rounded-lg text-sm text-center hover:bg-neutral-50"
                    >
                      Düzenle
                    </Link>
                    <form action={toggleRoutingRuleAction}>
                      <input type="hidden" name="ruleId" value={r.id} />
                      <button
                        type="submit"
                        className="w-full px-3 py-1.5 border rounded-lg text-sm hover:bg-neutral-50"
                      >
                        {r.enabled ? 'Kapat' : 'Aç'}
                      </button>
                    </form>
                    <form action={deleteRoutingRuleAction}>
                      <input type="hidden" name="ruleId" value={r.id} />
                      <button
                        type="submit"
                        className="w-full px-3 py-1.5 border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50"
                      >
                        Sil
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6 text-sm">
        <h3 className="font-bold text-blue-900 mb-2">📘 Conditions JSON örnekleri</h3>
        <div className="space-y-3 text-blue-900">
          <div>
            <strong>İstanbul siparişlerini consolidate et:</strong>
            <pre className="mt-1 p-2 bg-white rounded text-xs">
{`{ "field": "shipping.city", "op": "eq", "value": "İstanbul" }`}
            </pre>
          </div>
          <div>
            <strong>500 TL üstü VE 3+ vendor:</strong>
            <pre className="mt-1 p-2 bg-white rounded text-xs">
{`{
  "all": [
    { "field": "total_cents", "op": ">=", "value": 50000 },
    { "field": "vendor_count", "op": ">=", "value": 3 }
  ]
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
