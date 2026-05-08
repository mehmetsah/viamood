'use client';

import { useActionState } from 'react';
import { vendorOnboardingAction } from '@/lib/actions/vendor';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ActionResult } from '@/lib/actions/auth';

const initialState: ActionResult | null = null;

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => vendorOnboardingAction(formData),
    initialState,
  );

  const fieldErrors = state && !state.success ? state.fieldErrors ?? {} : {};

  return (
    <div className="min-h-screen px-4 py-12 bg-[var(--color-brand-cream)]">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs font-bold tracking-widest uppercase text-[var(--color-brand-orange)] mb-3">
            ADIM 1 / 2
          </p>
          <h1 className="text-3xl font-bold mb-2">Tedarikçi Bilgileri</h1>
          <p className="text-neutral-600 text-sm">
            Bilgileri girdikten sonra başvurun admin onayına düşer. Onay sonrası ürün ekleyebilirsin.
          </p>
          <p className="text-xs text-neutral-500 mt-3">
            Yanlış hesap mı?{' '}
            <a
              href="/api/auth/signout?callbackUrl=/auth/sign-in"
              className="text-[var(--color-brand-orange)] font-semibold hover:underline"
            >
              Çıkış yap
            </a>
          </p>
        </div>

        <form action={formAction} className="bg-white rounded-2xl shadow-sm border p-8 flex flex-col gap-5">
          <h2 className="text-base font-bold border-b pb-2">Mağaza</h2>
          <Input
            name="name"
            label="Mağaza adı (görünür)"
            placeholder="Örn: Via Mood Mutfak"
            required
            error={fieldErrors.name}
          />
          <Input
            name="description"
            label="Kısa açıklama (opsiyonel)"
            placeholder="Ne sattığını 1-2 cümleyle anlat"
            error={fieldErrors.description}
          />

          <h2 className="text-base font-bold border-b pb-2 mt-4">Yasal Bilgiler</h2>
          <Input
            name="legalName"
            label="Yasal unvan (vergi levhasındaki)"
            placeholder="Via Glocal Dış Tic. Ltd. Şti."
            required
            error={fieldErrors.legalName}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="taxId"
              label="Vergi / TC No"
              placeholder="9250770472"
              required
              error={fieldErrors.taxId}
              maxLength={11}
            />
            <Input
              name="taxOffice"
              label="Vergi dairesi"
              placeholder="Beyoğlu"
              required
              error={fieldErrors.taxOffice}
            />
          </div>

          <h2 className="text-base font-bold border-b pb-2 mt-4">İletişim</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="email"
              type="email"
              label="Mağaza e-posta"
              placeholder="info@firma.com"
              required
              error={fieldErrors.email}
            />
            <Input
              name="phone"
              type="tel"
              label="Telefon"
              placeholder="0553 170 71 32"
              required
              error={fieldErrors.phone}
            />
          </div>

          <h2 className="text-base font-bold border-b pb-2 mt-4">Adres</h2>
          <Input
            name="addressLine1"
            label="Adres"
            placeholder="Bostan Mh. Kaşkaval Sk. No:23"
            required
            error={fieldErrors.addressLine1}
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              name="city"
              label="İl"
              placeholder="İstanbul"
              required
              error={fieldErrors.city}
            />
            <Input
              name="district"
              label="İlçe"
              placeholder="Beyoğlu"
              required
              error={fieldErrors.district}
            />
            <Input
              name="postalCode"
              label="Posta kodu"
              placeholder="34433"
              error={fieldErrors.postalCode}
            />
          </div>

          <h2 className="text-base font-bold border-b pb-2 mt-4">Banka (opsiyonel)</h2>
          <p className="text-xs text-neutral-500 -mt-3">Cari ödeme yöntemi için. Sonradan da ekleyebilirsin.</p>
          <Input
            name="iban"
            label="IBAN"
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            error={fieldErrors.iban}
            hint="TR ile başlayıp 26 hane"
          />
          <Input
            name="accountHolderName"
            label="Hesap sahibi adı"
            placeholder="Via Glocal Dış Tic. Ltd. Şti."
            error={fieldErrors.accountHolderName}
          />

          {state && !state.success && !state.fieldErrors && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <Button type="submit" loading={pending} fullWidth size="lg" className="mt-4">
            Başvuruyu gönder
          </Button>
          <p className="text-xs text-center text-neutral-500">
            Gönderdikten sonra başvurun admin onayına düşer. Genelde 1 iş günü.
          </p>
        </form>
      </div>
    </div>
  );
}
