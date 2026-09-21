'use client';

import { useActionState } from 'react';
import { sosyalAyarlariKaydet, type ActionSonuc } from '@/lib/actions/social-auth';
import {
  SAGLAYICI_ETIKET,
  SOSYAL_SAGLAYICILAR,
  type SaglayiciOzeti,
  type SosyalAyarOzeti,
  type SosyalSaglayici,
} from '@/lib/auth/sosyal-ayar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * Bir sağlayıcının alanları. Google ve Facebook AYNI bileşenden çizilir —
 * iki bölüm birbirinden kaymaz. Secret alanına değer BASILMAZ (yalnız maskeli
 * placeholder); boş bırakılırsa sunucu mevcut değeri korur.
 */
function SaglayiciAlanlari({ p, o }: { p: SosyalSaglayici; o: SaglayiciOzeti }) {
  const e = SAGLAYICI_ETIKET[p];
  return (
    <>
      <label className="flex items-center gap-3">
        <input type="checkbox" name={`${p}_enabled`} defaultChecked={o.acik}
               className="w-4 h-4" />
        <span className="font-medium text-sm">{e.ad} ile giriş açık</span>
      </label>

      <Input name={`${p}_client_id`} label={`${e.ad} ${e.kimlik}`}
             defaultValue={o.kimlik}
             placeholder={e.kimlikOrnek} autoComplete="off" />

      <Input name={`${p}_client_secret`} type="password" label={`${e.ad} ${e.anahtar}`}
             placeholder={o.secret_var ? o.secret_maskeli : e.anahtarOrnek}
             hint={o.secret_var
               ? 'Kayıtlı. Değiştirmek istemiyorsan BOŞ bırak — mevcut değer korunur.'
               : e.anahtarKaynak}
             autoComplete="new-password" />
    </>
  );
}

export function SosyalGirisForm({ ayar }: { ayar: SosyalAyarOzeti }) {
  const [state, formAction, pending] = useActionState(
    async (_p: ActionSonuc | null, fd: FormData) => sosyalAyarlariKaydet(fd),
    null as ActionSonuc | null,
  );

  return (
    <form action={formAction} className="bg-white rounded-2xl border p-6 flex flex-col gap-4">
      {SOSYAL_SAGLAYICILAR.map((p, i) => (
        <div key={p} className={`flex flex-col gap-4${i > 0 ? ' border-t pt-4' : ''}`}>
          <SaglayiciAlanlari p={p} o={ayar[p]} />
        </div>
      ))}

      {state && !state.ok && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.hata}
        </p>
      )}
      {state?.ok && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Kaydedildi. Giriş ekranındaki Google düğmesi anında devreye girer.
        </p>
      )}

      <Button type="submit" loading={pending} size="lg">Kaydet</Button>
    </form>
  );
}
