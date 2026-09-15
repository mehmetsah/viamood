'use client';

import { useActionState } from 'react';
import { sosyalAyarlariKaydet, type ActionSonuc } from '@/lib/actions/social-auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Ayar = {
  google_enabled: boolean;
  google_client_id: string;
  google_secret_maskeli: string;
  google_secret_var: boolean;
};

export function SosyalGirisForm({ ayar }: { ayar: Ayar }) {
  const [state, formAction, pending] = useActionState(
    async (_p: ActionSonuc | null, fd: FormData) => sosyalAyarlariKaydet(fd),
    null as ActionSonuc | null,
  );

  return (
    <form action={formAction} className="bg-white rounded-2xl border p-6 flex flex-col gap-4">
      <label className="flex items-center gap-3">
        <input type="checkbox" name="google_enabled" defaultChecked={ayar.google_enabled}
               className="w-4 h-4" />
        <span className="font-medium text-sm">Google ile giriş açık</span>
      </label>

      <Input name="google_client_id" label="Google Client ID"
             defaultValue={ayar.google_client_id}
             placeholder="…apps.googleusercontent.com" autoComplete="off" />

      <Input name="google_client_secret" type="password" label="Google Client Secret"
             placeholder={ayar.google_secret_var ? ayar.google_secret_maskeli : 'GOCSPX-…'}
             hint={ayar.google_secret_var
               ? 'Kayıtlı. Değiştirmek istemiyorsan BOŞ bırak — mevcut değer korunur.'
               : 'Google Cloud Console → Credentials ekranından alınır.'}
             autoComplete="new-password" />

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
