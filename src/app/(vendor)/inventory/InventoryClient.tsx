'use client';

import { useState, useTransition } from 'react';
import { adjustInventoryAction, setInventoryAction } from '@/lib/actions/inventory';

interface Row {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  quantity: number;
  reserved: number;
  available: number;
}

interface Props {
  rows: Row[];
}

export function InventoryClient({ rows }: Props) {
  const [filter, setFilter] = useState('');

  const filtered = rows.filter(
    (r) =>
      !filter ||
      r.productTitle.toLowerCase().includes(filter.toLowerCase()) ||
      (r.sku ?? '').toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Ürün adı veya SKU ara..."
        className="w-full max-w-md h-10 px-4 rounded-lg border border-neutral-300 bg-white text-sm outline-none focus:border-[var(--color-brand-orange)]"
      />

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Ürün / Varyant</th>
              <th className="text-left px-4 py-3 font-semibold w-32">SKU</th>
              <th className="text-right px-4 py-3 font-semibold w-24">Toplam</th>
              <th className="text-right px-4 py-3 font-semibold w-24">Rezerve</th>
              <th className="text-right px-4 py-3 font-semibold w-24">Müsait</th>
              <th className="text-right px-4 py-3 font-semibold w-72">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r) => (
              <InventoryRow key={r.variantId} row={r} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-neutral-500 text-sm">
            Aramaya uyan ürün yok
          </div>
        )}
      </div>
    </div>
  );
}

function InventoryRow({ row }: { row: Row }) {
  const [pending, startTransition] = useTransition();
  const [setValue, setSetValue] = useState(String(row.quantity));

  function adjust(delta: number) {
    const fd = new FormData();
    fd.set('variantId', row.variantId);
    fd.set('delta', String(delta));
    startTransition(async () => {
      await adjustInventoryAction(fd);
    });
  }

  function setExact(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set('variantId', row.variantId);
    fd.set('quantity', setValue);
    startTransition(async () => {
      await setInventoryAction(fd);
    });
  }

  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt="" className="w-9 h-9 object-cover rounded border" />
          ) : (
            <div className="w-9 h-9 bg-neutral-100 rounded border flex items-center justify-center text-neutral-400 text-xs">
              📦
            </div>
          )}
          <div>
            <div className="font-semibold">{row.productTitle}</div>
            {row.variantTitle && row.variantTitle !== 'Default' && (
              <div className="text-xs text-neutral-500">{row.variantTitle}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{row.sku ?? '-'}</td>
      <td className="px-4 py-3 text-right font-mono">{row.quantity}</td>
      <td className="px-4 py-3 text-right font-mono text-neutral-500">{row.reserved}</td>
      <td className="px-4 py-3 text-right font-mono font-bold">{row.available}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => adjust(-1)}
            disabled={pending}
            className="w-8 h-8 rounded-lg border hover:bg-neutral-100 disabled:opacity-50"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => adjust(+1)}
            disabled={pending}
            className="w-8 h-8 rounded-lg border hover:bg-neutral-100 disabled:opacity-50"
          >
            +
          </button>
          <form onSubmit={setExact} className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={setValue}
              onChange={(e) => setSetValue(e.target.value)}
              className="w-20 h-8 px-2 border rounded text-sm text-right"
            />
            <button
              type="submit"
              disabled={pending}
              className="px-2 h-8 bg-neutral-800 text-white rounded text-xs font-semibold hover:bg-neutral-700 disabled:opacity-50"
            >
              Ayarla
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
