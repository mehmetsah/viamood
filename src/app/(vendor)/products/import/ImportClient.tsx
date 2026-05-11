'use client';

import { useActionState } from 'react';
import {
  importProductsAction,
  parseProductCsvAction,
  type ImportActionResult,
  type ParseActionResult,
} from '@/lib/actions/product-import';

export function ImportClient() {
  const [parseState, parseAction, parsing] = useActionState<ParseActionResult | null, FormData>(
    parseProductCsvAction,
    null,
  );
  const [importState, importAction, importing] = useActionState<ImportActionResult | null, FormData>(
    importProductsAction,
    null,
  );

  if (importState?.success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <div className="text-5xl mb-3">✓</div>
        <h2 className="text-xl font-bold text-green-900 mb-2">İçeri aktarma tamam</h2>
        <p className="text-sm text-green-800 mb-2">
          <strong>{importState.created}</strong> ürün eklendi.
          {importState.skipped! > 0 && <> {importState.skipped} satır atlandı.</>}
        </p>
        {importState.errors && importState.errors.length > 0 && (
          <details className="mt-4 text-left max-w-md mx-auto">
            <summary className="text-sm text-red-700 cursor-pointer font-semibold">
              Atlanan satırlar ({importState.errors.length})
            </summary>
            <ul className="mt-2 text-xs space-y-1 bg-white border rounded p-3">
              {importState.errors.slice(0, 50).map((e, i) => (
                <li key={i}>
                  Satır {e.rowNumber}: {e.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="flex gap-3 justify-center mt-6">
          <a href="/products" className="px-5 py-2 bg-black text-white rounded-lg text-sm font-semibold">
            Ürünlere dön
          </a>
          <a href="/products/import" className="px-5 py-2 border rounded-lg text-sm font-semibold">
            Tekrar yükle
          </a>
        </div>
      </div>
    );
  }

  if (parseState?.preview) {
    const preview = parseState.preview;
    return (
      <div>
        <section className="bg-white rounded-xl border p-5 mb-6">
          <h2 className="font-bold mb-3">Önizleme</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
            <div>
              <div className="text-xs text-neutral-500">Tanınan satır</div>
              <div className="text-2xl font-bold">{preview.rows.length}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Toplam satır</div>
              <div className="text-2xl font-bold">{preview.totalRows}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Hata</div>
              <div className="text-2xl font-bold text-red-600">{preview.errors.length}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Tanınan sütun</div>
              <div className="text-2xl font-bold">{Object.keys(preview.detectedColumns).length}</div>
            </div>
          </div>

          <details className="mb-3 text-xs">
            <summary className="cursor-pointer font-semibold text-neutral-700">
              Sütun eşleştirmesi
            </summary>
            <div className="mt-2 bg-neutral-50 rounded p-3 space-y-1">
              {Object.entries(preview.detectedColumns).map(([col, field]) => (
                <div key={col} className="flex justify-between font-mono">
                  <span>{col}</span>
                  <span className="text-green-700">→ {field}</span>
                </div>
              ))}
            </div>
          </details>

          {preview.errors.length > 0 && (
            <details className="mb-3 text-xs">
              <summary className="cursor-pointer font-semibold text-red-700">
                Hata satırları ({preview.errors.length})
              </summary>
              <div className="mt-2 bg-red-50 rounded p-3 max-h-40 overflow-auto">
                {preview.errors.slice(0, 100).map((e, i) => (
                  <div key={i}>
                    Satır {e.rowNumber} ({e.field}): {e.message}
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        <section className="bg-white rounded-xl border overflow-hidden mb-6">
          <div className="px-4 py-3 bg-neutral-50 border-b">
            <strong>İlk 50 satır</strong> — kontrol edip onaylayın
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-neutral-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Başlık</th>
                  <th className="text-left px-3 py-2">SKU</th>
                  <th className="text-right px-3 py-2">Fiyat</th>
                  <th className="text-right px-3 py-2">Stok</th>
                  <th className="text-left px-3 py-2">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.rows.slice(0, 50).map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="px-3 py-1.5 text-neutral-500">{r.rowNumber}</td>
                    <td className="px-3 py-1.5">{r.title}</td>
                    <td className="px-3 py-1.5 font-mono text-neutral-600">{r.sku ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {(r.priceCents / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </td>
                    <td className="px-3 py-1.5 text-right">{r.initialStock}</td>
                    <td className="px-3 py-1.5">
                      <span className={
                        r.status === 'active' ? 'text-green-700' : 'text-neutral-500'
                      }>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 50 && (
            <div className="px-4 py-2 text-xs text-neutral-500 border-t">
              … ve {preview.rows.length - 50} satır daha
            </div>
          )}
        </section>

        <form action={importAction} className="flex gap-3">
          <input type="hidden" name="rows" value={JSON.stringify(preview.rows)} />
          <button
            type="submit"
            disabled={importing || preview.rows.length === 0}
            className="px-6 py-3 bg-black text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {importing ? 'Yükleniyor...' : `✓ ${preview.rows.length} ürünü içeri aktar`}
          </button>
          <a
            href="/products/import"
            className="px-6 py-3 border rounded-lg font-semibold"
          >
            İptal — Yeniden seç
          </a>
        </form>
        {importState && !importState.success && (
          <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ⚠ {importState.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={parseAction} className="bg-white rounded-xl border p-8">
      <label className="block">
        <span className="text-sm font-semibold mb-2 block">Dosya seçin</span>
        <input
          type="file"
          name="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          required
          className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neutral-900 file:text-white hover:file:bg-neutral-700"
        />
        <p className="text-xs text-neutral-500 mt-2">
          CSV (.csv) veya tab-separated (.tsv / .txt). Excel için önce "Farklı kaydet → CSV UTF-8" yapın.
        </p>
      </label>
      <button
        type="submit"
        disabled={parsing}
        className="mt-6 px-5 py-2.5 bg-black text-white rounded-lg font-semibold disabled:opacity-50"
      >
        {parsing ? 'Okunuyor...' : 'Önizleme oluştur'}
      </button>
      {parseState?.error && (
        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ⚠ {parseState.error}
        </p>
      )}
    </form>
  );
}
