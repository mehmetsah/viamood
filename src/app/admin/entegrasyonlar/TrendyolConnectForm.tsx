'use client';

import { useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ActionResult } from '@/lib/actions/auth';
import type { TrendyolTestResult } from '@/lib/trendyol/integration';

interface Existing {
  supplierId: string;
  status: 'disconnected' | 'connected' | 'error';
  lastTestedAt: string | null;
  lastError: string | null;
  productCount: number | null;
}

interface Props {
  vendorId: string;
  vendorName: string;
  existing: Existing | null;
  connectAction: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  testAction: (vendorId: string) => Promise<TrendyolTestResult>;
}

const badge: Record<Existing['status'], { label: string; cls: string }> = {
  connected: { label: '● Bağlı', cls: 'bg-green-50 text-green-700 border-green-200' },
  error: { label: '● Hata', cls: 'bg-red-50 text-red-700 border-red-200' },
  disconnected: { label: '○ Test edilmedi', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
};

export function TrendyolConnectForm({ vendorId, vendorName, existing, connectAction, testAction }: Props) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(connectAction, null);
  const [open, setOpen] = useState(false);
  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<TrendyolTestResult | null>(null);
  const fieldErrors = state && !state.success ? (state.fieldErrors ?? {}) : {};

  const st = existing?.status ?? 'disconnected';
  const b = badge[st];

  function runTest() {
    setTestResult(null);
    startTest(async () => {
      const r = await testAction(vendorId);
      setTestResult(r);
    });
  }

  return (
    <div className="bg-white border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-semibold">{vendorName}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${b.cls}`}>{b.label}</span>
          {existing && (
            <span className="text-xs text-neutral-500">
              Trendyol · satıcı {existing.supplierId}
              {existing.productCount != null ? ` · ${existing.productCount}+ ürün` : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {existing && (
            <Button type="button" variant="secondary" size="sm" onClick={runTest} loading={testing}>
              Bağlantıyı test et
            </Button>
          )}
          <Button type="button" variant={existing ? 'secondary' : 'primary'} size="sm" onClick={() => setOpen((o) => !o)}>
            {existing ? 'Bilgileri güncelle' : 'Trendyol bağla'}
          </Button>
        </div>
      </div>

      {existing?.status === 'error' && existing.lastError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Son test hatası: {existing.lastError}
        </div>
      )}

      {open && (
        <form action={formAction} className="border-t pt-3 flex flex-col gap-3">
          <input type="hidden" name="vendorId" value={vendorId} />
          <p className="text-xs text-neutral-500">
            Trendyol Satıcı Paneli → Entegrasyon Bilgileri&apos;nden alınır. Bilgiler şifreli saklanır.
          </p>
          <Input
            name="supplierId"
            label="Satıcı ID (supplierId)"
            defaultValue={existing?.supplierId ?? ''}
            placeholder="örn. 123456"
            error={fieldErrors.supplierId}
          />
          <Input name="apiKey" label="API Key" placeholder="Trendyol API Key" error={fieldErrors.apiKey} />
          <Input
            name="secretKey"
            label="API Secret"
            type="password"
            placeholder="Trendyol API Secret"
            error={fieldErrors.secretKey}
          />

          {state && !state.success && !state.fieldErrors && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
              ✓ Kaydedildi. Şimdi &quot;Bağlantıyı test et&quot; ile doğrula.
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" size="sm" loading={pending}>
              Kaydet
            </Button>
          </div>
        </form>
      )}

      {testResult && (
        <div className="border-t pt-3">
          {testResult.ok ? (
            <>
              <div className="text-sm text-green-700 mb-2">
                ✓ Bağlantı başarılı — {testResult.productCount}+ ürün görüldü. Örnek:
              </div>
              <div className="overflow-x-auto">
                <table className="text-xs w-full border-collapse">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="py-1 pr-3">Barkod</th>
                      <th className="py-1 pr-3">Başlık</th>
                      <th className="py-1 pr-3">Satış</th>
                      <th className="py-1 pr-3">Liste</th>
                      <th className="py-1 pr-3">Stok</th>
                      <th className="py-1">Görsel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResult.sample.map((s, i) => (
                      <tr key={i} className="border-t border-neutral-100">
                        <td className="py-1 pr-3 font-mono">{s.barcode || '—'}</td>
                        <td className="py-1 pr-3">{s.title || '—'}</td>
                        <td className="py-1 pr-3">{s.salePrice != null ? s.salePrice.toFixed(2) : '—'}</td>
                        <td className="py-1 pr-3">{s.listPrice != null ? s.listPrice.toFixed(2) : '—'}</td>
                        <td className="py-1 pr-3">{s.quantity}</td>
                        <td className="py-1">{s.hasImage ? '✓' : '✗'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ✗ Test başarısız: {testResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
