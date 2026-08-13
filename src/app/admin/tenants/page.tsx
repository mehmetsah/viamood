/**
 * /admin/tenants — Tenant (marka/instance) yönetim paneli.
 * Kod TEK repo, marka başına AYRI instance; bu panel ana instance'tan envanteri yönetir
 * ve her instance'ın /api/health ucundan canlı durum okur.
 */
import { db } from '@/db/client';
import { tenants, type Tenant } from '@/db/schema/tenants';
import { TenantsClient } from './TenantsClient';

export const dynamic = 'force-dynamic';

export interface TenantHealth {
  ok: boolean;
  detail: string;
}

async function checkHealth(t: Tenant): Promise<TenantHealth> {
  if (!t.appUrl) return { ok: false, detail: 'appUrl tanımsız' };
  try {
    const res = await fetch(`${t.appUrl.replace(/\/$/, '')}/api/health`, {
      signal: AbortSignal.timeout(3500),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const j = (await res.json().catch(() => ({}))) as { status?: string; version?: string };
    return { ok: true, detail: j.version ? `v${j.version}` : (j.status ?? 'ok') };
  } catch (e) {
    const msg = e instanceof Error ? e.name : 'hata';
    return { ok: false, detail: msg === 'TimeoutError' ? 'zaman aşımı' : 'erişilemiyor' };
  }
}

export default async function TenantsPage() {
  const rows = await db.select().from(tenants).orderBy(tenants.createdAt);
  const health = await Promise.all(rows.map((t) => checkHealth(t)));
  const list = rows.map((t, i) => ({ ...t, health: health[i]! }));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🏬 Tenant Yönetimi</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kod tek repo&apos;da; her marka kendi kurulumuyla (env + DB + Shopify mağazası) çalışır. Tek{' '}
          <code className="bg-gray-100 px-1 rounded">git push</code> tüm kurulumları günceller. Bu sayfa envanter + canlı sağlık gösterir.
        </p>
      </div>
      <TenantsClient tenants={JSON.parse(JSON.stringify(list))} />
    </div>
  );
}
