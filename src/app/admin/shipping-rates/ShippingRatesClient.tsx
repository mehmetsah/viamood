'use client';

import { useState, useTransition } from 'react';
import {
  deleteBracketAction,
  pushToShopifyAction,
  refreshKargolabAction,
  upsertBracketAction,
} from '@/lib/actions/shipping-rates';

interface Bracket {
  id: string;
  name: string;
  description: string | null;
  weightLowGrams: number;
  weightHighGrams: number;
  countryCode: string;
  kargolabBaseCents: number | null;
  kargolabCourier: string | null;
  kargolabFetchedAt: { at: string } | null;
  marginPct: number;
  marginFlatCents: number;
  priceCents: number;
  currency: string;
  status: 'draft' | 'active' | 'archived';
  shopifyMethodId: string | null;
  shopifyPushedAt: { at: string } | null;
  sortOrder: number;
}

const formatTL = (cents: number) =>
  (cents / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  ' ₺';

const fmtTime = (d: { at: string } | null) => {
  if (!d?.at) return '—';
  return new Date(d.at).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
};

export function ShippingRatesClient({
  initialBrackets,
}: {
  initialBrackets: Bracket[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [editing, setEditing] = useState<Bracket | 'new' | null>(null);

  const totalActive = initialBrackets.filter((b) => b.status === 'active').length;
  const lastSync = initialBrackets
    .map((b) => b.kargolabFetchedAt?.at)
    .filter(Boolean)
    .sort()
    .pop();
  const lastShopify = initialBrackets
    .map((b) => b.shopifyPushedAt?.at)
    .filter(Boolean)
    .sort()
    .pop();

  async function onRefresh() {
    setMsg(null);
    startTransition(async () => {
      const r = await refreshKargolabAction();
      setMsg(r.success ? { kind: 'ok', text: r.details ?? 'KargoLab fiyatları güncellendi' } : { kind: 'err', text: r.error ?? '' });
    });
  }

  async function onPushShopify() {
    setMsg(null);
    startTransition(async () => {
      const r = await pushToShopifyAction();
      setMsg(r.success ? { kind: 'ok', text: r.details ?? 'Shopify\'a push edildi' } : { kind: 'err', text: r.error ?? '' });
    });
  }

  return (
    <div className="space-y-6">
      {/* Stat row */}
      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Toplam Bracket" value={initialBrackets.length.toString()} />
        <Stat label="Aktif" value={totalActive.toString()} hint={totalActive > 0 ? 'TR Domestic zone' : 'tanımlı yok'} />
        <Stat label="Son KargoLab Sync" value={lastSync ? new Date(lastSync).toLocaleDateString('tr-TR') : 'Hiç'} hint={lastSync ? new Date(lastSync).toLocaleTimeString('tr-TR') : ''} />
        <Stat label="Son Shopify Push" value={lastShopify ? new Date(lastShopify).toLocaleDateString('tr-TR') : 'Hiç'} hint={lastShopify ? new Date(lastShopify).toLocaleTimeString('tr-TR') : ''} />
      </div>

      {/* Actions */}
      <section className="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRefresh}
          disabled={pending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40"
        >
          {pending ? '⏳…' : '🔄 KargoLab Base Yenile'}
        </button>
        <button
          type="button"
          onClick={onPushShopify}
          disabled={pending}
          className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-40"
        >
          {pending ? '⏳…' : '🛍 Shopify\'a Push Et'}
        </button>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="ml-auto px-4 py-2 border-2 border-orange-500 text-orange-700 text-sm font-semibold rounded-lg hover:bg-orange-50"
        >
          + Yeni Bracket
        </button>
      </section>

      {msg && (
        <div className={`rounded-xl p-4 text-sm ${msg.kind === 'ok' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {msg.kind === 'ok' ? '✅' : '⛔'} {msg.text}
        </div>
      )}

      {/* Table */}
      <section className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-3 font-semibold">Bracket</th>
              <th className="text-right p-3 font-semibold">Ağırlık</th>
              <th className="text-right p-3 font-semibold">KargoLab Base</th>
              <th className="text-right p-3 font-semibold">Margin</th>
              <th className="text-right p-3 font-semibold">Satış Fiyatı</th>
              <th className="text-center p-3 font-semibold">Durum</th>
              <th className="text-center p-3 font-semibold">Shopify</th>
              <th className="text-right p-3 font-semibold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {initialBrackets.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-neutral-500 italic">Henüz bracket yok. "+ Yeni Bracket" ile başla.</td></tr>
            )}
            {initialBrackets.map((b) => (
              <tr key={b.id} className="border-t hover:bg-neutral-50/50">
                <td className="p-3">
                  <div className="font-semibold">{b.name}</div>
                  {b.description && <div className="text-xs text-neutral-500">{b.description}</div>}
                </td>
                <td className="text-right p-3 font-mono text-xs">
                  {(b.weightLowGrams / 1000).toFixed(2)} – {(b.weightHighGrams / 1000).toFixed(2)} kg
                </td>
                <td className="text-right p-3">
                  {b.kargolabBaseCents != null ? (
                    <div>
                      <div className="font-mono">{formatTL(b.kargolabBaseCents)}</div>
                      <div className="text-[10px] text-neutral-500">{b.kargolabCourier} · {fmtTime(b.kargolabFetchedAt)}</div>
                    </div>
                  ) : (
                    <span className="text-neutral-400 text-xs italic">Yenile bas</span>
                  )}
                </td>
                <td className="text-right p-3 font-mono text-xs">
                  +{b.marginPct}%{b.marginFlatCents > 0 ? ` + ${formatTL(b.marginFlatCents)}` : ''}
                </td>
                <td className="text-right p-3 font-mono font-bold">{formatTL(b.priceCents)}</td>
                <td className="text-center p-3">
                  <span className={`text-[10px] uppercase font-semibold px-2 py-1 rounded ${
                    b.status === 'active' ? 'bg-green-100 text-green-800'
                      : b.status === 'draft' ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-neutral-100 text-neutral-600'
                  }`}>{b.status}</span>
                </td>
                <td className="text-center p-3 text-xs">
                  {b.shopifyPushedAt?.at ? (
                    <div className="text-green-700">✓ {fmtTime(b.shopifyPushedAt)}</div>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="text-right p-3">
                  <button onClick={() => setEditing(b)} className="text-blue-600 hover:underline text-xs mr-3">Düzenle</button>
                  <form action={deleteBracketAction} className="inline" onSubmit={(e) => { if (!confirm('Silinsin mi?')) e.preventDefault(); }}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className="text-red-600 hover:underline text-xs">Sil</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Edit modal */}
      {editing && <EditModal bracket={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="text-[11px] text-neutral-500 mt-1">{hint}</div>}
    </div>
  );
}

function EditModal({ bracket, onClose }: { bracket: Bracket | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-bold text-lg">{bracket ? 'Bracket Düzenle' : 'Yeni Bracket'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-2xl">×</button>
        </div>
        <form action={upsertBracketAction} className="space-y-3">
          {bracket && <input type="hidden" name="id" value={bracket.id} />}
          <Field label="Görünür Ad *">
            <input name="name" required defaultValue={bracket?.name ?? ''} placeholder="Standart Kargo (X-Y kg)" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Açıklama (opsiyonel)">
            <textarea name="description" rows={2} defaultValue={bracket?.description ?? ''} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Alt Ağırlık (gr) *">
              <input name="weightLowGrams" type="number" required defaultValue={bracket?.weightLowGrams ?? 0} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Üst Ağırlık (gr) *">
              <input name="weightHighGrams" type="number" required defaultValue={bracket?.weightHighGrams ?? 3000} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Margin %">
              <input name="marginPct" type="number" defaultValue={bracket?.marginPct ?? 15} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Margin Sabit (TL cent)">
              <input name="marginFlatCents" type="number" defaultValue={bracket?.marginFlatCents ?? 0} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sıralama">
              <input name="sortOrder" type="number" defaultValue={bracket?.sortOrder ?? 100} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Durum">
              <select name="status" defaultValue={bracket?.status ?? 'active'} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="active">active</option>
                <option value="draft">draft</option>
                <option value="archived">archived</option>
              </select>
            </Field>
          </div>
          {bracket?.kargolabBaseCents != null && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs">
              <div>KargoLab base: <strong>{formatTL(bracket.kargolabBaseCents)}</strong> ({bracket.kargolabCourier})</div>
              <div>Mevcut satış fiyatı: <strong>{formatTL(bracket.priceCents)}</strong></div>
              <div className="text-[10px] text-neutral-500 mt-1">Margin değişimi otomatik fiyatı yeniden hesaplar.</div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">İptal</button>
            <button type="submit" className="px-5 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700">Kaydet</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold mb-1 block uppercase tracking-wider text-neutral-600">{label}</span>
      {children}
    </label>
  );
}
