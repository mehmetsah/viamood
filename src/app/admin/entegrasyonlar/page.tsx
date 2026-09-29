import { eq, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { vendorIntegrations, vendors } from '@/db/schema';
import { connectTrendyolAction, testTrendyolAction } from '@/lib/actions/trendyol';
import { TrendyolConnectForm } from './TrendyolConnectForm';

export const dynamic = 'force-dynamic';

export default async function EntegrasyonlarPage() {
  const vendorRows = await db
    .select({ id: vendors.id, name: vendors.name, slug: vendors.slug, status: vendors.status })
    .from(vendors)
    .where(ne(vendors.status, 'archived'))
    .orderBy(vendors.name);

  const integ = await db
    .select()
    .from(vendorIntegrations)
    .where(eq(vendorIntegrations.provider, 'trendyol'));

  const byVendor = new Map(integ.map((i) => [i.vendorId, i]));

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">🔌 Entegrasyonlar</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Tedarikçilerin pazaryeri mağazalarını bağla. Trendyol ürünleri resmi API ile çekilir —
          API bilgileri şifreli saklanır, kimse düz metin göremez.
        </p>
      </header>

      {vendorRows.length === 0 && (
        <p className="text-sm text-neutral-500">Aktif tedarikçi yok.</p>
      )}

      <div className="flex flex-col gap-4">
        {vendorRows.map((v) => {
          const row = byVendor.get(v.id) ?? null;
          return (
            <TrendyolConnectForm
              key={v.id}
              vendorId={v.id}
              vendorName={v.name}
              existing={
                row
                  ? {
                      supplierId: row.externalSupplierId,
                      status: row.status,
                      lastTestedAt: row.lastTestedAt ? row.lastTestedAt.toISOString() : null,
                      lastError: row.lastError,
                      productCount: row.productCount,
                    }
                  : null
              }
              connectAction={connectTrendyolAction}
              testAction={testTrendyolAction}
            />
          );
        })}
      </div>
    </div>
  );
}
