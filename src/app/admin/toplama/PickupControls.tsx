'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import type { GenerateResult, StopResult } from '@/lib/routing/pickup-run';

export interface StopView {
  id: string;
  seq: number;
  vendorName: string;
  city: string | null;
  district: string | null;
  itemCount: number;
  totalQuantity: number;
  status: 'pending' | 'collected' | 'received' | 'skipped';
}

export interface RunView {
  id: string;
  status: 'planned' | 'collecting' | 'completed' | 'cancelled';
  runDate: string;
  stopCount: number;
  itemCount: number;
  totalQuantity: number;
  stops: StopView[];
}

const RUN_LABEL: Record<RunView['status'], string> = {
  planned: 'Planlandı',
  collecting: 'Toplanıyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

const STOP_BADGE: Record<StopView['status'], { label: string; cls: string }> = {
  pending: { label: 'Bekliyor', cls: 'bg-yellow-100 text-yellow-800' },
  collected: { label: 'Toplandı', cls: 'bg-green-100 text-green-800' },
  received: { label: 'Depoda', cls: 'bg-blue-100 text-blue-800' },
  skipped: { label: 'Atlandı', cls: 'bg-neutral-100 text-neutral-600' },
};

interface Props {
  run: RunView | null;
  canGenerate: boolean;
  generateAction: () => Promise<GenerateResult>;
  collectAction: (stopId: string) => Promise<StopResult>;
}

export function PickupControls({ run, canGenerate, generateAction, collectAction }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyStop, setBusyStop] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function generate() {
    setMsg(null);
    startTransition(async () => {
      const r = await generateAction();
      if (!r.ok) setMsg(r.error);
      router.refresh();
    });
  }

  function collect(stopId: string) {
    setBusyStop(stopId);
    startTransition(async () => {
      const r = await collectAction(stopId);
      if (!r.ok) setMsg(r.error);
      setBusyStop(null);
      router.refresh();
    });
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-bold">Toplama Turu (rota)</h2>
        {canGenerate && (
          <Button size="sm" onClick={generate} loading={pending && !busyStop}>
            {run ? 'Yeni rota oluştur' : 'Toplama rotası oluştur'}
          </Button>
        )}
      </div>

      {msg && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {msg}
        </div>
      )}

      {!run ? (
        <div className="bg-white rounded-xl border p-6 text-sm text-neutral-500">
          Henüz toplama turu yok. Aşağıda toplanacak kalem varsa &quot;Toplama rotası oluştur&quot; ile
          tedarikçi-bazlı rota oluşturulur.
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b bg-neutral-50 text-sm">
            <span>
              <strong>{run.runDate}</strong> · {run.stopCount} durak · {run.itemCount} kalem ·{' '}
              {run.totalQuantity} adet
            </span>
            <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-xs">
              {RUN_LABEL[run.status]}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b">
                <th className="px-5 py-2 font-medium w-10">#</th>
                <th className="px-5 py-2 font-medium">Tedarikçi</th>
                <th className="px-5 py-2 font-medium">Konum</th>
                <th className="px-5 py-2 font-medium text-right">Kalem/Adet</th>
                <th className="px-5 py-2 font-medium">Durum</th>
                <th className="px-5 py-2 font-medium text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {run.stops.map((s) => {
                const b = STOP_BADGE[s.status];
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-5 py-2 font-mono text-neutral-500">{s.seq}</td>
                    <td className="px-5 py-2 font-medium">{s.vendorName}</td>
                    <td className="px-5 py-2 text-neutral-500">
                      {[s.district, s.city].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-2 text-right">
                      {s.itemCount} / <strong>{s.totalQuantity}</strong>
                    </td>
                    <td className="px-5 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${b.cls}`}>
                        {b.label}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right">
                      {s.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => collect(s.id)}
                          loading={pending && busyStop === s.id}
                        >
                          Toplandı
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
