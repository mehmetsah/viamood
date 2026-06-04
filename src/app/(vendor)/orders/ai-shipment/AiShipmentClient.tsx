'use client';

import { useState } from 'react';
import type { ShipmentExtraction } from '@/lib/ai/shipment-extractor';

type Source = 'whatsapp' | 'instagram' | 'other';

const SAMPLE_WHATSAPP = `Merhaba ben Mehmet Yılmaz
0532 555 11 22
Atatürk Mah. Cumhuriyet Cad. No:12/4 Çankaya/Ankara
2 adet mutfak organizer setinden istiyorum
Kapıda ödeme yapacağım
Posta kodu 06680`;

export function AiShipmentClient() {
  const [text, setText] = useState('');
  const [source, setSource] = useState<Source>('whatsapp');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShipmentExtraction | null>(null);
  const [meta, setMeta] = useState<{ model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function extract() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/v1/vendor/ai-shipment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, source }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(json.data);
      setMeta({ model: json.model_used });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Input */}
      <section className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm">1. Yazışmayı yapıştır</h2>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setText(SAMPLE_WHATSAPP)}
              className="text-blue-600 hover:underline"
            >
              📝 Örnek doldur
            </button>
            <button
              type="button"
              onClick={() => {
                setText('');
                setResult(null);
                setError(null);
              }}
              className="text-neutral-600 hover:underline"
            >
              Temizle
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-2 mb-3">
          {(['whatsapp', 'instagram', 'other'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={`text-xs px-3 py-2 rounded-lg border ${
                source === s
                  ? 'bg-orange-50 border-orange-400 text-orange-800 font-semibold'
                  : 'bg-white hover:bg-neutral-50'
              }`}
            >
              {s === 'whatsapp' && '💬 WhatsApp'}
              {s === 'instagram' && '📷 Instagram DM'}
              {s === 'other' && '📝 Diğer / SMS'}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Müşteri yazışmasını buraya yapıştır…"
          className="w-full border rounded-lg p-3 text-sm font-mono"
          disabled={loading}
        />

        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] text-neutral-500">
            {text.length}/8000 karakter
          </span>
          <button
            type="button"
            onClick={extract}
            disabled={loading || text.trim().length < 5}
            className="px-5 py-2 bg-orange-600 text-white font-semibold rounded-lg disabled:opacity-40 hover:bg-orange-700"
          >
            {loading ? '⏳ AI çözümlüyor…' : '🤖 AI ile Çıkar'}
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          ⛔ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <section className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm">2. AI çıktısı (düzelt → onayla)</h2>
            <div className="flex items-center gap-3 text-xs">
              <span
                className={`px-2 py-1 rounded font-mono ${
                  result.confidence > 0.8
                    ? 'bg-green-100 text-green-800'
                    : result.confidence > 0.5
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                confidence: {(result.confidence * 100).toFixed(0)}%
              </span>
              {meta && <span className="text-neutral-500">{meta.model}</span>}
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-xs space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <FieldGroup title="Alıcı">
              <Field label="Ad Soyad" value={result.receiver.name} />
              <Field label="Telefon" value={result.receiver.phone ?? '—'} mono />
              {result.receiver.phone_alt && (
                <Field label="Telefon 2" value={result.receiver.phone_alt} mono />
              )}
              {result.receiver.email && (
                <Field label="E-posta" value={result.receiver.email} mono />
              )}
            </FieldGroup>

            <FieldGroup title="Adres">
              <Field label="İl" value={result.address.province ?? '—'} highlight />
              <Field label="İlçe" value={result.address.district ?? '—'} highlight />
              {result.address.neighborhood && (
                <Field label="Mahalle" value={result.address.neighborhood} />
              )}
              {result.address.postal_code && (
                <Field label="Posta Kodu" value={result.address.postal_code} mono />
              )}
              <div className="mt-2">
                <div className="text-[11px] text-neutral-500 mb-1">Tam adres</div>
                <div className="bg-neutral-50 rounded p-2 text-xs whitespace-pre-wrap">
                  {result.address.full || '—'}
                </div>
              </div>
            </FieldGroup>

            <FieldGroup title="Ürünler">
              {result.items.map((it, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-1 border-b last:border-0"
                >
                  <div>
                    <div className="font-semibold">{it.description}</div>
                    <div className="text-[11px] text-neutral-500">
                      {it.quantity} adet
                      {it.unit_price_try != null
                        ? ` · ${it.unit_price_try.toLocaleString('tr-TR')} ₺`
                        : ''}
                    </div>
                  </div>
                  <div className="font-mono text-xs">{it.quantity}x</div>
                </div>
              ))}
            </FieldGroup>

            <FieldGroup title="Ödeme & Notlar">
              <Field
                label="Ödeme yöntemi"
                value={
                  result.payment.method === 'cod'
                    ? '💵 Kapıda Ödeme'
                    : result.payment.method === 'paid'
                      ? '✅ Ödendi'
                      : '❓ Belirsiz'
                }
                highlight={result.payment.method === 'cod'}
              />
              {result.payment.cod_amount_try != null && (
                <Field
                  label="Tahsil"
                  value={`${result.payment.cod_amount_try.toLocaleString('tr-TR')} ₺`}
                  mono
                />
              )}
              {result.notes && (
                <div className="mt-2">
                  <div className="text-[11px] text-neutral-500 mb-1">Notlar</div>
                  <div className="bg-neutral-50 rounded p-2 text-xs">{result.notes}</div>
                </div>
              )}
            </FieldGroup>
          </div>

          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <details className="text-xs">
              <summary className="cursor-pointer text-neutral-600">
                Raw JSON
              </summary>
              <pre className="mt-2 bg-neutral-50 p-3 rounded text-[10px] overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  // KargoLab push — TODO: implement
                  alert('KargoLab push henüz implement edilmedi. Bu JSON kullanıma hazır.');
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40"
                disabled={result.confidence < 0.4}
              >
                📨 KargoLab&apos;a Yolla
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                }}
                className="px-4 py-2 border text-sm font-semibold rounded-lg hover:bg-neutral-50"
              >
                📋 JSON Kopyala
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3 bg-neutral-50/50">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600 mb-2">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-neutral-600">{label}:</span>
      <span
        className={[
          mono ? 'font-mono' : '',
          highlight ? 'font-bold text-orange-700' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
