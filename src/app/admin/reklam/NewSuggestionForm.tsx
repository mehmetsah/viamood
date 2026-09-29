'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { ActionResult } from '@/lib/actions/auth';

interface Props {
  products: { id: string; title: string }[];
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}

const selectCls =
  'h-11 w-full px-4 rounded-lg border border-neutral-300 bg-white text-[15px] outline-none focus:border-[var(--color-brand-orange)] focus:ring-2 focus:ring-[var(--color-brand-orange)]/20';

export function NewSuggestionForm({ products, action }: Props) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const [open, setOpen] = useState(false);
  const fieldErrors = state && !state.success ? state.fieldErrors ?? {} : {};

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="lg">
        + Yeni reklam önerisi
      </Button>
    );
  }

  return (
    <form action={formAction} className="bg-white border rounded-xl p-6 flex flex-col gap-4">
      <h2 className="font-bold border-b pb-2">Yeni reklam önerisi</h2>

      <div>
        <label htmlFor="productId" className="text-sm font-medium text-neutral-800 block mb-1.5">
          Ürün <span className="text-red-500">*</span>
        </label>
        <select id="productId" name="productId" required defaultValue="" className={selectCls}>
          <option value="" disabled>— Ürün seç —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        {fieldErrors.productId && <p className="text-xs text-red-600 mt-1">{fieldErrors.productId}</p>}
      </div>

      <Textarea
        name="reason"
        label="Neden iddialı? (öneri notu)"
        rows={3}
        placeholder="Bu ürünü reklama uygun bulma sebebin..."
        error={fieldErrors.reason}
      />

      <div>
        <label htmlFor="collabType" className="text-sm font-medium text-neutral-800 block mb-1.5">
          İçerik türü
        </label>
        <select id="collabType" name="collabType" defaultValue="" className={selectCls}>
          <option value="">— Seçilmedi —</option>
          <option value="existing_video">Hazır video var (link)</option>
          <option value="collaboration">İşbirliği önerisi (ürün hediye)</option>
        </select>
      </div>

      <Input
        name="videoUrl"
        label="Video linki (opsiyonel)"
        placeholder="https://instagram.com/..."
        error={fieldErrors.videoUrl}
      />
      <Textarea name="videoNote" label="Not (opsiyonel)" rows={2} error={fieldErrors.videoNote} />

      {state && !state.success && !state.fieldErrors && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">
          ✓ Öneri eklendi (senin oyun otomatik “evet”)
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Vazgeç
        </Button>
        <Button type="submit" loading={pending}>Öneriyi aç</Button>
      </div>
    </form>
  );
}
