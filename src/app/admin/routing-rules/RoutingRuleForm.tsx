'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

interface FormDefaults {
  name?: string;
  description?: string;
  priority?: string;
  action?: 'split' | 'consolidate_self' | 'consolidate_carrier';
  conditions?: string;
  enabled?: boolean;
  ruleId?: string;
}

interface Props {
  defaults?: FormDefaults;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}

export function RoutingRuleForm({ defaults = {}, action, submitLabel }: Props) {
  const [conditionsText, setConditionsText] = useState(
    defaults.conditions ?? '{\n  "field": "shipping.city",\n  "op": "eq",\n  "value": "İstanbul"\n}',
  );
  const [conditionsError, setConditionsError] = useState<string | null>(null);

  function validateConditions(text: string) {
    try {
      JSON.parse(text);
      setConditionsError(null);
      return true;
    } catch (e) {
      setConditionsError(e instanceof Error ? e.message : 'JSON geçersiz');
      return false;
    }
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      {defaults.ruleId && <input type="hidden" name="ruleId" value={defaults.ruleId} />}

      <section className="bg-white rounded-xl border p-6 flex flex-col gap-4">
        <Input
          name="name"
          label="Kural adı"
          placeholder="İstanbul siparişlerini birleştir"
          required
          defaultValue={defaults.name}
        />
        <Textarea
          name="description"
          label="Açıklama (opsiyonel)"
          rows={2}
          placeholder="Bu kuralın ne yaptığını kısaca anlat"
          defaultValue={defaults.description}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            name="priority"
            label="Öncelik"
            type="number"
            min="0"
            max="10000"
            required
            defaultValue={defaults.priority ?? '100'}
            hint="Düşük sayı önce değerlendirilir (1, 2, 3 ...)"
          />
          <div>
            <label htmlFor="action" className="text-sm font-medium block mb-1.5">
              Aksiyon
            </label>
            <select
              id="action"
              name="action"
              defaultValue={defaults.action ?? 'split'}
              className="h-11 w-full px-4 rounded-lg border border-neutral-300 bg-white text-[15px]"
            >
              <option value="split">Split — her vendor kendi paketini gönderir</option>
              <option value="consolidate_self">
                Consolidate (biz) — vendor'lar bizim depoya gönderir
              </option>
              <option value="consolidate_carrier">
                Consolidate (kargocu) — KargoLab multi-pickup
              </option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={defaults.enabled ?? true}
            className="w-4 h-4"
          />
          Aktif
        </label>
      </section>

      <section className="bg-white rounded-xl border p-6 flex flex-col gap-3">
        <label className="text-sm font-medium">Koşullar (JSON)</label>
        <textarea
          name="conditions"
          rows={12}
          value={conditionsText}
          onChange={(e) => {
            setConditionsText(e.target.value);
            validateConditions(e.target.value);
          }}
          className={`px-4 py-3 rounded-lg border ${
            conditionsError ? 'border-red-500' : 'border-neutral-300'
          } bg-white text-[13px] outline-none font-mono resize-y`}
          required
        />
        {conditionsError && <p className="text-xs text-red-600">{conditionsError}</p>}
        <details className="text-xs text-neutral-600">
          <summary className="cursor-pointer hover:text-neutral-900">
            Mevcut field'lar ve operatörler
          </summary>
          <div className="mt-2 space-y-1 pl-4">
            <p>
              <strong>Field'lar:</strong> total_cents, subtotal_cents, shipping_cents, vendor_count,
              line_item_count, total_weight_grams, currency, shipping.city, shipping.district,
              shipping.country, customer.email, tags
            </p>
            <p>
              <strong>Operatörler:</strong> eq, ne, in, not_in, &gt;=, &lt;=, &gt;, &lt;, contains, exists
            </p>
            <p>
              <strong>Bileşik:</strong> {`{ "all": [...] }`}, {`{ "any": [...] }`}, {`{ "not": {...} }`}
            </p>
          </div>
        </details>
      </section>

      <div className="flex gap-3 justify-end">
        <Button type="submit" size="lg" disabled={!!conditionsError}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
