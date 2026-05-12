import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { auditLog, users } from '@/db/schema';
import { Pagination, parsePage } from '@/components/ui/Pagination';

const PAGE_SIZE = 30;

interface PageProps {
  searchParams: Promise<{ q?: string; entity?: string; page?: string }>;
}

const ACTION_GROUP_COLOR: Record<string, string> = {
  vendor: 'bg-blue-100 text-blue-900',
  product: 'bg-green-100 text-green-900',
  order: 'bg-orange-100 text-orange-900',
  payout: 'bg-purple-100 text-purple-900',
  user: 'bg-pink-100 text-pink-900',
  routing: 'bg-yellow-100 text-yellow-900',
};

export default async function AuditLogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { q, entity } = sp;
  const page = parsePage(sp.page);

  const conds = [];
  if (entity) conds.push(eq(auditLog.entityType, entity));
  if (q) conds.push(or(ilike(auditLog.action, `%${q}%`), ilike(auditLog.entityId, `%${q}%`)));
  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const _cnt_total = await db .select({ total: count() }).from(auditLog).where(whereClause);
  const total = _cnt_total[0]?.total ?? 0;

  const entries = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      actorType: auditLog.actorType,
      actorId: auditLog.actorId,
      actorEmail: users.email,
      actorName: users.name,
      before: auditLog.before,
      after: auditLog.after,
      occurredAt: auditLog.occurredAt,
    })
    .from(auditLog)
    // audit_log.actor_id text, users.id uuid → cast gerek
    .leftJoin(users, sql`${users.id}::text = ${auditLog.actorId}`)
    .where(whereClause)
    .orderBy(desc(auditLog.occurredAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Audit Log</h1>
      <p className="text-neutral-600 text-sm mb-8">
        Sistem değişiklikleri (immutable). KVKK + güvenlik için.
      </p>

      <form className="flex gap-2 mb-6">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="action veya entity ID ara..."
          className="flex-1 max-w-md h-10 px-4 border rounded-lg text-sm"
        />
        <select
          name="entity"
          defaultValue={entity ?? ''}
          className="h-10 px-3 border rounded-lg text-sm"
        >
          <option value="">Tüm entity'ler</option>
          <option value="vendor">Vendor</option>
          <option value="product">Product</option>
          <option value="order">Order</option>
          <option value="payout">Payout</option>
          <option value="user">User</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-[var(--color-brand-ink)] text-white rounded-lg text-sm">
          Filtrele
        </button>
        {(q || entity) && (
          <Link href="/admin/audit-log" className="px-4 py-2 border rounded-lg text-sm hover:bg-neutral-50">
            Sıfırla
          </Link>
        )}
      </form>

      {total === 0 ? (
        <div className="bg-white rounded-xl p-12 border text-center text-sm text-neutral-500">
          Audit kaydı yok
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold w-44">Tarih</th>
                <th className="text-left px-4 py-3 font-semibold w-40">Aktör</th>
                <th className="text-left px-4 py-3 font-semibold">Action</th>
                <th className="text-left px-4 py-3 font-semibold w-44">Entity</th>
                <th className="text-left px-4 py-3 font-semibold">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((e) => {
                const group = e.action.split('.')[0]!;
                const groupColor = ACTION_GROUP_COLOR[group] ?? 'bg-neutral-100 text-neutral-700';
                const hasDiff = e.before || e.after;
                return (
                  <tr key={e.id} className="hover:bg-neutral-50 align-top">
                    <td className="px-4 py-3 text-xs font-mono text-neutral-600">
                      {e.occurredAt.toLocaleString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-semibold">{e.actorName ?? e.actorType}</div>
                      <div className="text-neutral-500">{e.actorEmail ?? e.actorId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded font-mono ${groupColor}`}>
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-semibold">{e.entityType}</div>
                      {e.entityId && (
                        <div className="font-mono text-neutral-500 truncate max-w-[10ch]">
                          {e.entityId.slice(0, 8)}...
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {hasDiff ? (
                        <details>
                          <summary className="cursor-pointer text-[var(--color-brand-orange)] hover:underline">
                            Diff göster
                          </summary>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <div className="font-semibold text-red-700 mb-1">Before</div>
                              <pre className="p-2 bg-red-50 border border-red-100 rounded font-mono overflow-auto max-h-40">
                                {JSON.stringify(e.before, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <div className="font-semibold text-green-700 mb-1">After</div>
                              <pre className="p-2 bg-green-50 border border-green-100 rounded font-mono overflow-auto max-h-40">
                                {JSON.stringify(e.after, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </details>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            totalCount={total}
            currentPage={page}
            pageSize={PAGE_SIZE}
            searchParams={sp}
          />
        </div>
      )}
    </div>
  );
}
