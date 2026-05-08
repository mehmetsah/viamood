import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { shopifyConnections } from '@/db/schema';
import { env } from '@/lib/env';

interface PageProps {
  searchParams: Promise<{ connected?: string; shop?: string; error?: string }>;
}

function formatScopes(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export default async function ShopifyAdminPage({ searchParams }: PageProps) {
  const { connected, shop, error } = await searchParams;

  const [conn] = await db
    .select()
    .from(shopifyConnections)
    .where(eq(shopifyConnections.shopDomain, env.SHOPIFY_STORE_DOMAIN))
    .limit(1);

  const isConnected = !!conn && !conn.uninstalledAt;
  const scopes = formatScopes(conn?.scope);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Shopify Bağlantısı</h1>
      <p className="text-neutral-600 text-sm mb-8">
        Vendor platform'un Shopify Admin API'ye yazma yetkisi için OAuth bağlantısı.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-800">
          ⛔ {error}
        </div>
      )}

      {connected && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-800">
          ✓ <strong>{shop}</strong> başarıyla bağlandı
        </div>
      )}

      <section className="bg-white rounded-xl border p-6">
        <h2 className="font-bold mb-4">Mevcut Bağlantı</h2>

        {isConnected ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-neutral-600">Shop domain</span>
              <span className="font-mono">{conn.shopDomain}</span>
            </div>
            {conn.shopName && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-neutral-600">Mağaza adı</span>
                <span>{conn.shopName}</span>
              </div>
            )}
            {conn.shopEmail && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-neutral-600">E-posta</span>
                <span>{conn.shopEmail}</span>
              </div>
            )}
            {conn.currency && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-neutral-600">Para birimi</span>
                <span>{conn.currency}</span>
              </div>
            )}
            {conn.primaryLocationId && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-neutral-600">Primary location ID</span>
                <span className="font-mono">{conn.primaryLocationId}</span>
              </div>
            )}
            <div className="flex justify-between border-b pb-2">
              <span className="text-neutral-600">Bağlantı tarihi</span>
              <span>{conn.installedAt.toLocaleString('tr-TR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Token (kısaltılmış)</span>
              <span className="font-mono text-xs">
                {conn.accessToken.slice(0, 12)}...{conn.accessToken.slice(-4)}
              </span>
            </div>
            <div className="pt-3 border-t">
              <div className="text-xs text-neutral-500 mb-2">Scopes ({scopes.length}):</div>
              <div className="flex flex-wrap gap-1">
                {scopes.map((s) => (
                  <span
                    key={s}
                    className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t mt-4">
              <a
                href="/api/shopify/oauth/install"
                className="inline-flex items-center px-4 py-2 border-2 border-[var(--color-brand-ink)] rounded-full text-sm font-semibold hover:bg-neutral-100"
              >
                🔄 Yeniden Bağla / Scope Yenile
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">🛒</div>
            <h3 className="font-bold mb-2">Henüz bağlanmadı</h3>
            <p className="text-neutral-600 text-sm mb-6 max-w-md mx-auto">
              Vendor ürünlerinin Shopify'a otomatik senkronize olması ve sipariş webhook'larının
              alınması için Shopify mağazasını OAuth ile bağla.
            </p>
            <a
              href="/api/shopify/oauth/install"
              className="inline-flex items-center px-6 py-3 bg-[var(--color-brand-ink)] text-white rounded-full font-semibold hover:opacity-90"
            >
              🔗 Shopify Mağazasını Bağla
            </a>
            <p className="text-xs text-neutral-500 mt-4">
              Tıkladığında <code>{env.SHOPIFY_STORE_DOMAIN}</code> üzerinde Shopify auth ekranına gider.
            </p>
          </div>
        )}
      </section>

      <section className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-6 text-sm text-blue-900">
        <h3 className="font-bold mb-2">📘 OAuth Akışı</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>"Bağla" tıkla → Shopify auth ekranına gidersin</li>
          <li>"Install" / "Update" tıkla → permission'ları onayla</li>
          <li>Otomatik buraya geri döner, token DB'ye kaydedilir</li>
          <li>Vendor platform Admin API'ye ürün/sipariş yazabilir</li>
        </ol>
        <div className="mt-3 text-xs">
          <strong>Redirect URL'inin Partners Dashboard'da kayıtlı olması şart:</strong>{' '}
          <code className="bg-white px-2 py-0.5 rounded">{env.APP_URL}/api/shopify/oauth/callback</code>
        </div>
      </section>
    </div>
  );
}
