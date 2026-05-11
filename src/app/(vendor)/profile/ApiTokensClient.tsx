'use client';

import { useActionState, useState } from 'react';
import { createApiTokenAction, revokeApiTokenAction, type CreateTokenResponse } from '@/lib/actions/api-token';

interface Token {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  expiresAt: string | null;
}

interface Props {
  tokens: Token[];
}

const SCOPE_LABELS: Record<string, string> = {
  'products:read': 'Ürün oku',
  'products:write': 'Ürün yaz/güncelle',
  'inventory:read': 'Stok oku',
  'inventory:write': 'Stok güncelle',
  'orders:read': 'Sipariş oku',
};

export function ApiTokensClient({ tokens }: Props) {
  const [state, action, pending] = useActionState<CreateTokenResponse | null, FormData>(
    createApiTokenAction,
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState(false);

  const newToken = state?.success ? state.plaintext : null;

  return (
    <section className="bg-white rounded-2xl shadow-sm border p-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">🔑 API Erişimi</h2>
        {!showForm && !newToken && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-black text-white rounded-lg font-semibold text-sm"
          >
            + Yeni Token
          </button>
        )}
      </div>
      <p className="text-sm text-neutral-600 mb-6">
        Kendi sisteminizden (Trendyol, IKAS, WooCommerce, ERP, vb.) Via Mood'a ürün ve stok push etmek
        için Bearer token. Detaylı API dokümantasyonu için{' '}
        <a href="/api/v1/docs" className="text-[var(--color-brand-orange)] underline">
          /api/v1/docs
        </a>{' '}
        (yakında).
      </p>

      {newToken && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-5 mb-6">
          <h3 className="font-bold text-yellow-900 mb-2">⚠ Token sadece şimdi gösteriliyor</h3>
          <p className="text-sm text-yellow-800 mb-3">
            Bu token bir daha gösterilmeyecek. Şimdi güvenli bir yere kaydedin (password manager).
          </p>
          <div className="bg-white border rounded-lg px-3 py-2 font-mono text-sm break-all mb-3">
            {newToken}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(newToken);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-3 py-1.5 bg-black text-white rounded text-sm font-semibold"
            >
              {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                window.location.reload();
              }}
              className="px-3 py-1.5 border rounded text-sm font-semibold"
            >
              Anladım, kaydettim
            </button>
          </div>
        </div>
      )}

      {showForm && !newToken && (
        <form action={action} className="bg-neutral-50 rounded-xl p-5 mb-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Token adı</label>
            <input
              name="name"
              type="text"
              required
              maxLength={80}
              placeholder="Örn: Trendyol Sync, WooCommerce, IKAS bridge"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">İzinler (scope)</label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(SCOPE_LABELS).map(([scope, label]) => (
                <label key={scope} className="flex items-center gap-2 bg-white border rounded px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="scopes"
                    value={scope}
                    defaultChecked={scope.endsWith(':write') || scope.endsWith(':read')}
                  />
                  <span>{label}</span>
                  <code className="text-xs text-neutral-400 ml-auto">{scope}</code>
                </label>
              ))}
            </div>
          </div>
          {state && !state.success && state.error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 bg-black text-white rounded-lg font-semibold text-sm disabled:opacity-50"
            >
              {pending ? 'Oluşturuluyor...' : 'Token oluştur'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-lg text-sm font-semibold"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {tokens.length === 0 ? (
        <div className="text-sm text-neutral-500 text-center py-8 border-t">
          Henüz token yok.
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Token</th>
                <th className="text-left px-4 py-3 font-semibold">İzinler</th>
                <th className="text-left px-4 py-3 font-semibold">Son kullanım</th>
                <th className="text-right px-4 py-3 font-semibold w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs font-mono text-neutral-500">{t.prefix}…</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {t.scopes.map((s) => (
                        <code key={s} className="bg-neutral-100 px-2 py-0.5 rounded">
                          {s}
                        </code>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {t.lastUsedAt
                      ? new Date(t.lastUsedAt).toLocaleString('tr-TR')
                      : 'Hiç'}
                    {t.lastUsedIp && (
                      <div className="text-neutral-400 font-mono">{t.lastUsedIp}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form
                      action={revokeApiTokenAction}
                      onSubmit={(e) => {
                        if (!confirm(`"${t.name}" token'ı iptal etmek istediğine emin misin?`))
                          e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="tokenId" value={t.id} />
                      <button
                        type="submit"
                        className="text-xs px-2 py-1 text-red-700 hover:bg-red-50 rounded"
                      >
                        İptal et
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="mt-6 text-sm">
        <summary className="cursor-pointer font-semibold text-neutral-700">
          📘 API kullanım örneği (curl)
        </summary>
        <pre className="mt-3 bg-neutral-900 text-neutral-100 rounded-lg p-4 text-xs overflow-x-auto">{`# Toplu ürün ekleme / güncelleme (SKU bazlı upsert)
curl -X POST https://viamood.kargolab.com/api/v1/vendor/products \\
  -H "Authorization: Bearer vnd_xxxxxxxx_yyyyyyyyy" \\
  -H "Content-Type: application/json" \\
  -d '{
    "products": [
      {
        "sku": "ABC-001",
        "title": "Ürün başlığı",
        "price": 99.99,
        "stock": 25,
        "barcode": "8680001234567",
        "imageUrl": "https://cdn.example.com/abc-001.jpg",
        "status": "active"
      }
    ]
  }'

# Sadece stok güncelleme
curl -X POST https://viamood.kargolab.com/api/v1/vendor/inventory \\
  -H "Authorization: Bearer vnd_xxxxxxxx_yyyyyyyyy" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      { "sku": "ABC-001", "quantity": 25 },
      { "sku": "ABC-002", "quantity": 0 }
    ]
  }'`}</pre>
      </details>
    </section>
  );
}
