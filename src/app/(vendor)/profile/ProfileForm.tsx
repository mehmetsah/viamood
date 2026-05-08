'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { changePasswordAction, updateVendorProfileAction } from '@/lib/actions/vendor-profile';
import type { ActionResult } from '@/lib/actions/auth';

interface Props {
  defaults: {
    name: string;
    description: string;
    email: string;
    phone: string;
    website: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    district: string;
    postalCode: string;
    iban: string;
    accountHolderName: string;
    bankName: string;
    taxId: string;
    taxOffice: string;
  };
}

export function ProfileForm({ defaults }: Props) {
  const [profileState, profileAction, profilePending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => updateVendorProfileAction(fd),
    null,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => changePasswordAction(fd),
    null,
  );

  const profileErrors = profileState && !profileState.success ? profileState.fieldErrors ?? {} : {};
  const passwordErrors = passwordState && !passwordState.success ? passwordState.fieldErrors ?? {} : {};

  return (
    <div className="flex flex-col gap-8">
      <form action={profileAction} className="bg-white rounded-xl border p-6 flex flex-col gap-4">
        <h2 className="font-bold border-b pb-2">Mağaza</h2>
        <Input name="name" label="Mağaza adı" required defaultValue={defaults.name} error={profileErrors.name} />
        <Textarea
          name="description"
          label="Açıklama"
          rows={3}
          defaultValue={defaults.description}
        />

        <h2 className="font-bold border-b pb-2 mt-4">İletişim</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input
            name="email"
            type="email"
            label="E-posta"
            required
            defaultValue={defaults.email}
            error={profileErrors.email}
          />
          <Input name="phone" label="Telefon" defaultValue={defaults.phone} error={profileErrors.phone} />
        </div>
        <Input name="website" label="Website (opsiyonel)" defaultValue={defaults.website} error={profileErrors.website} />

        <h2 className="font-bold border-b pb-2 mt-4">Adres</h2>
        <Input
          name="addressLine1"
          label="Adres satırı 1"
          required
          defaultValue={defaults.addressLine1}
          error={profileErrors.addressLine1}
        />
        <Input
          name="addressLine2"
          label="Adres satırı 2 (opsiyonel)"
          defaultValue={defaults.addressLine2}
        />
        <div className="grid grid-cols-3 gap-4">
          <Input name="city" label="İl" required defaultValue={defaults.city} error={profileErrors.city} />
          <Input name="district" label="İlçe" required defaultValue={defaults.district} />
          <Input name="postalCode" label="Posta kodu" defaultValue={defaults.postalCode} />
        </div>

        <h2 className="font-bold border-b pb-2 mt-4">Banka (cari mod payouts için)</h2>
        <Input name="iban" label="IBAN" defaultValue={defaults.iban} error={profileErrors.iban} hint="TR ile başlayıp 26 hane" />
        <div className="grid grid-cols-2 gap-4">
          <Input
            name="accountHolderName"
            label="Hesap sahibi"
            defaultValue={defaults.accountHolderName}
          />
          <Input name="bankName" label="Banka" defaultValue={defaults.bankName} />
        </div>

        <h2 className="font-bold border-b pb-2 mt-4">Yasal (sadece okuma)</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Vergi numarası" value={defaults.taxId} disabled />
          <Input label="Vergi dairesi" value={defaults.taxOffice} disabled />
        </div>
        <p className="text-xs text-neutral-500">
          Vergi bilgileri admin onaylı değişir — değiştirmek için{' '}
          <a href="mailto:vendor@viamood.com" className="underline">
            vendor@viamood.com
          </a>
          'a yaz.
        </p>

        {profileState && !profileState.success && !profileState.fieldErrors && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {profileState.error}
          </p>
        )}
        {profileState?.success && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            ✓ Profil güncellendi
          </p>
        )}

        <Button type="submit" loading={profilePending} className="self-start mt-2">
          Kaydet
        </Button>
      </form>

      {/* Password change */}
      <form action={passwordAction} className="bg-white rounded-xl border p-6 flex flex-col gap-4">
        <h2 className="font-bold border-b pb-2">Şifre Değiştir</h2>
        <Input
          name="currentPassword"
          type="password"
          label="Mevcut şifre"
          required
          autoComplete="current-password"
          error={passwordErrors.currentPassword}
        />
        <Input
          name="newPassword"
          type="password"
          label="Yeni şifre"
          required
          autoComplete="new-password"
          hint="8+ karakter, büyük/küçük harf ve rakam"
          error={passwordErrors.newPassword}
        />

        {passwordState && !passwordState.success && !passwordState.fieldErrors && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {passwordState.error}
          </p>
        )}
        {passwordState?.success && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            ✓ Şifre değiştirildi
          </p>
        )}

        <Button type="submit" loading={passwordPending} className="self-start mt-2">
          Şifreyi değiştir
        </Button>
      </form>
    </div>
  );
}
