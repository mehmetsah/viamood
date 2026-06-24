'use client';

import { useActionState } from 'react';
import { changePasswordAction, updateProfileAction } from '@/lib/actions/customer';
import { type ActionResult } from '@/lib/actions/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function Banner({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (state.success) {
    return (
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        Kaydedildi.
      </p>
    );
  }
  if (!state.fieldErrors) {
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        {state.error}
      </p>
    );
  }
  return null;
}

export function ProfileForms({
  initialName,
  initialPhone,
  email,
}: {
  initialName: string;
  initialPhone: string;
  email: string;
}) {
  const [pState, pAction, pPending] = useActionState(
    async (_p: ActionResult | null, fd: FormData) => updateProfileAction(fd),
    null as ActionResult | null,
  );
  const [wState, wAction, wPending] = useActionState(
    async (_p: ActionResult | null, fd: FormData) => changePasswordAction(fd),
    null as ActionResult | null,
  );
  const pErr = pState && !pState.success ? pState.fieldErrors ?? {} : {};
  const wErr = wState && !wState.success ? wState.fieldErrors ?? {} : {};

  return (
    <div className="flex flex-col gap-6">
      <form action={pAction} className="bg-white rounded-2xl border p-6 flex flex-col gap-4">
        <h2 className="font-semibold">Profil bilgileri</h2>
        <Input label="E-posta" value={email} disabled className="bg-neutral-100 text-neutral-500" />
        <Input name="name" label="Ad Soyad" defaultValue={initialName} required error={pErr.name} autoComplete="name" />
        <Input name="phone" label="Telefon" defaultValue={initialPhone} autoComplete="tel" placeholder="5XX XXX XX XX" />
        <Banner state={pState} />
        <Button type="submit" loading={pPending} className="self-start">Kaydet</Button>
      </form>

      <form action={wAction} className="bg-white rounded-2xl border p-6 flex flex-col gap-4">
        <h2 className="font-semibold">Şifre değiştir</h2>
        <Input name="current" type="password" label="Mevcut şifre" required error={wErr.current} autoComplete="current-password" />
        <Input name="next" type="password" label="Yeni şifre" required error={wErr.next} hint="8+ karakter, büyük/küçük harf ve rakam" autoComplete="new-password" />
        <Input name="confirm" type="password" label="Yeni şifre (tekrar)" required error={wErr.confirm} autoComplete="new-password" />
        <Banner state={wState} />
        <Button type="submit" loading={wPending} className="self-start">Şifreyi güncelle</Button>
      </form>
    </div>
  );
}
