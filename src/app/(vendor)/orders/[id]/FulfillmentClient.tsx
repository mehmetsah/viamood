'use client';

import { useActionState, useState } from 'react';
import {
  createFulfillmentAction,
  getFulfillmentLabelAction,
  refreshTrackingAction,
} from '@/lib/actions/fulfillment';

interface FulfillmentRow {
  id: string;
  status: string;
  statusLabel: { label: string; cls: string };
  kargolabShipmentId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  carrier: string | null;
  labelCreatedAt: string | null;
  deliveredAt: string | null;
}

interface TrackingRow {
  id: string;
  status: string;
  description: string | null;
  location: string | null;
  occurredAt: string;
}

interface Props {
  orderId: string;
  fulfillment: FulfillmentRow | null;
  trackingEvents: TrackingRow[];
}

export function FulfillmentClient({ orderId, fulfillment, trackingEvents }: Props) {
  const [createState, createAction, creating] = useActionState(createFulfillmentAction, null);
  const [labelState, labelAction, labelLoading] = useActionState(
    getFulfillmentLabelAction,
    null,
  );
  const [trackState, trackAction, trackLoading] = useActionState(
    refreshTrackingAction,
    null,
  );
  const [courrier, setCourrier] = useState<'PTT' | 'ARAS' | 'MNG' | 'YURTICI' | 'SURAT'>('PTT');

  if (!fulfillment) {
    return (
      <section className="bg-white rounded-xl border p-6">
        <h3 className="font-bold mb-2">🚚 Kargo</h3>
        <p className="text-sm text-neutral-600 mb-4">
          Bu sipariş için henüz kargo etiketi oluşturulmadı. Kargo firmasını seç ve KargoLab
          üzerinden etiket oluştur.
        </p>
        <form action={createAction} className="flex flex-wrap gap-2 items-end">
          <input type="hidden" name="orderId" value={orderId} />
          <div>
            <label className="block text-xs font-semibold mb-1 text-neutral-700">
              Kargo firması
            </label>
            <select
              name="courrier"
              value={courrier}
              onChange={(e) => setCourrier(e.target.value as typeof courrier)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="PTT">PTT</option>
              <option value="ARAS">Aras</option>
              <option value="MNG">MNG</option>
              <option value="YURTICI">Yurtiçi</option>
              <option value="SURAT">Sürat</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-black text-white rounded-lg font-semibold text-sm disabled:opacity-50"
          >
            {creating ? 'Oluşturuluyor...' : '🏷️ Kargo etiketi oluştur'}
          </button>
        </form>
        {createState && !createState.success && (
          <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 break-words">
            ⚠ {createState.error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          🚚 Kargo
          <span className={`text-xs font-bold px-2 py-1 rounded ${fulfillment.statusLabel.cls}`}>
            {fulfillment.statusLabel.label}
          </span>
        </h3>
        <form action={trackAction}>
          <input type="hidden" name="fulfillmentId" value={fulfillment.id} />
          <button
            type="submit"
            disabled={trackLoading}
            className="text-xs px-3 py-1.5 border rounded-lg hover:bg-neutral-50 disabled:opacity-50"
          >
            {trackLoading ? 'Yenileniyor...' : '🔄 Takibi yenile'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <div className="text-xs text-neutral-500 mb-1">Kargo firması</div>
          <div className="font-semibold">{fulfillment.carrier ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 mb-1">Takip numarası</div>
          <div className="font-mono text-sm">{fulfillment.trackingNumber ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 mb-1">KargoLab Shipment ID</div>
          <div className="font-mono text-xs">{fulfillment.kargolabShipmentId ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500 mb-1">Etiket basıldı</div>
          <div className="text-sm">
            {fulfillment.labelCreatedAt
              ? new Date(fulfillment.labelCreatedAt).toLocaleString('tr-TR')
              : '—'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {fulfillment.labelUrl ? (
          <a
            href={fulfillment.labelUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-black text-white rounded-lg font-semibold text-sm"
          >
            📄 Etiketi aç
          </a>
        ) : (
          <form action={labelAction}>
            <input type="hidden" name="fulfillmentId" value={fulfillment.id} />
            <button
              type="submit"
              disabled={labelLoading}
              className="px-4 py-2 bg-black text-white rounded-lg font-semibold text-sm disabled:opacity-50"
            >
              {labelLoading ? 'Yükleniyor...' : '📄 Etiket linkini al'}
            </button>
          </form>
        )}
        {fulfillment.trackingUrl && (
          <a
            href={fulfillment.trackingUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 border rounded-lg font-semibold text-sm hover:bg-neutral-50"
          >
            🔍 Kargolab'da takip et
          </a>
        )}
      </div>

      {labelState && !labelState.success && (
        <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 break-words">
          ⚠ {labelState.error}
        </p>
      )}
      {trackState?.success === false && (
        <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 break-words">
          ⚠ {trackState.error}
        </p>
      )}
      {trackState?.success && trackState.events !== undefined && (
        <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          ✓ {trackState.events} yeni event eklendi
        </p>
      )}

      {trackingEvents.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-semibold text-sm mb-3">Takip Zaman Çizelgesi</h4>
          <ol className="relative border-l border-neutral-200 ml-2 space-y-3">
            {trackingEvents.map((ev) => (
              <li key={ev.id} className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-blue-500" />
                <div className="text-xs text-neutral-500">
                  {new Date(ev.occurredAt).toLocaleString('tr-TR')}
                  {ev.location ? ` · ${ev.location}` : ''}
                </div>
                <div className="text-sm font-semibold">{ev.status}</div>
                {ev.description && (
                  <div className="text-xs text-neutral-600">{ev.description}</div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
