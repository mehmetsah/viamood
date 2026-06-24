'use client';

import { useEffect, useMemo, useState } from 'react';
import { useActionState } from 'react';
import { type ActionResult } from '@/lib/actions/auth';
import { ILLER, getIlceler } from '@/lib/tr-addresses';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface AddressInit {
  id?: string;
  label?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  province?: string | null;
  district?: string | null;
  neighborhood?: string | null;
  address1?: string | null;
  postalCode?: string | null;
  isDefault?: boolean;
}

interface Props {
  action: (formData: FormData) => Promise<ActionResult>;
  initial?: AddressInit;
  submitLabel: string;
  onDone?: () => void;
}

const selectCls =
  'h-11 px-4 rounded-lg border border-neutral-300 bg-white text-[15px] outline-none transition focus:border-[var(--color-brand-orange)] focus:ring-2 focus:ring-[var(--color-brand-orange)]/20';

export function AddressForm({ action, initial, submitLabel, onDone }: Props) {
  const [il, setIl] = useState(initial?.province ?? '');
  const [ilce, setIlce] = useState(initial?.district ?? '');
  const ilceler = useMemo(() => (il ? getIlceler(il) : []), [il]);

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => action(formData),
    null as ActionResult | null,
  );
  const fieldErrors = state && !state.success ? state.fieldErrors ?? {} : {};

  useEffect(() => {
    if (state?.success && onDone) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="bg-white rounded-2xl border p-5 flex flex-col gap-4">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <Input name="label" label="Adres adı (opsiyonel)" placeholder="Ev, İş…" defaultValue={initial?.label ?? ''} />

      <div className="grid grid-cols-2 gap-4">
        <Input name="firstName" label="Ad" defaultValue={initial?.firstName ?? ''} autoComplete="given-name" />
        <Input name="lastName" label="Soyad" defaultValue={initial?.lastName ?? ''} autoComplete="family-name" />
      </div>

      <Input name="phone" label="Telefon" defaultValue={initial?.phone ?? ''} autoComplete="tel" placeholder="5XX XXX XX XX" />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="province" className="text-sm font-medium text-neutral-800">İl</label>
          <select
            id="province"
            name="province"
            required
            value={il}
            onChange={(e) => {
              setIl(e.target.value);
              setIlce('');
            }}
            className={selectCls}
          >
            <option value="">Seçin…</option>
            {ILLER.map((i) => (
              <option key={i.kod} value={i.ad}>
                {i.ad}
              </option>
            ))}
          </select>
          {fieldErrors.province && <p className="text-xs text-red-600">{fieldErrors.province}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="district" className="text-sm font-medium text-neutral-800">İlçe</label>
          <select
            id="district"
            name="district"
            required
            value={ilce}
            onChange={(e) => setIlce(e.target.value)}
            disabled={!il}
            className={`${selectCls} disabled:bg-neutral-100 disabled:text-neutral-400`}
          >
            <option value="">{il ? 'Seçin…' : 'Önce il seçin'}</option>
            {ilceler.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            {/* Kayıtlı ilçe listede yoksa yine de göster */}
            {ilce && !ilceler.includes(ilce) && <option value={ilce}>{ilce}</option>}
          </select>
          {fieldErrors.district && <p className="text-xs text-red-600">{fieldErrors.district}</p>}
        </div>
      </div>

      <Input name="neighborhood" label="Mahalle" defaultValue={initial?.neighborhood ?? ''} placeholder="Mahalle adı" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="address1" className="text-sm font-medium text-neutral-800">Açık adres</label>
        <textarea
          id="address1"
          name="address1"
          required
          defaultValue={initial?.address1 ?? ''}
          rows={2}
          placeholder="Cadde, sokak, bina no, daire"
          className="px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-[15px] outline-none transition focus:border-[var(--color-brand-orange)] focus:ring-2 focus:ring-[var(--color-brand-orange)]/20"
        />
        {fieldErrors.address1 && <p className="text-xs text-red-600">{fieldErrors.address1}</p>}
      </div>

      <Input name="postalCode" label="Posta kodu (opsiyonel)" defaultValue={initial?.postalCode ?? ''} className="max-w-[160px]" />

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="isDefault" defaultChecked={initial?.isDefault ?? false} className="size-4" />
        Varsayılan adres yap
      </label>

      {state && !state.success && !state.fieldErrors && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>{submitLabel}</Button>
        {onDone && (
          <button type="button" onClick={onDone} className="px-4 text-sm text-neutral-500 hover:text-neutral-800">
            Vazgeç
          </button>
        )}
      </div>
    </form>
  );
}
