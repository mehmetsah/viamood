'use client';

import { useState } from 'react';
import {
  addAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
} from '@/lib/actions/customer';
import { Button } from '@/components/ui/Button';
import { AddressForm, type AddressInit } from './AddressForm';

export interface AddressDTO extends AddressInit {
  id: string;
}

export function AddressBook({ addresses }: { addresses: AddressDTO[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {editing === 'new' ? (
        <AddressForm action={addAddressAction} submitLabel="Adresi kaydet" onDone={() => setEditing(null)} />
      ) : (
        <Button onClick={() => setEditing('new')} variant="secondary">
          + Yeni adres ekle
        </Button>
      )}

      {addresses.length === 0 && editing !== 'new' && (
        <div className="bg-white rounded-2xl border p-8 text-center text-neutral-600">
          Kayıtlı adresin yok. Yeni adres ekleyebilirsin.
        </div>
      )}

      {addresses.map((a) =>
        editing === a.id ? (
          <AddressForm
            key={a.id}
            action={updateAddressAction}
            initial={a}
            submitLabel="Değişiklikleri kaydet"
            onDone={() => setEditing(null)}
          />
        ) : (
          <div key={a.id} className="bg-white rounded-2xl border p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{a.label || 'Adres'}</span>
                  {a.isDefault && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                      Varsayılan
                    </span>
                  )}
                </div>
                <div className="text-sm text-neutral-600 mt-1 leading-relaxed">
                  {[a.firstName, a.lastName].filter(Boolean).join(' ')}
                  {a.phone ? ` · ${a.phone}` : ''}
                  <br />
                  {a.address1}
                  <br />
                  {[a.neighborhood, a.district, a.province].filter(Boolean).join(' / ')}
                  {a.postalCode ? ` · ${a.postalCode}` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 pt-4 border-t text-sm">
              <button
                onClick={() => setEditing(a.id)}
                className="text-[var(--color-brand-orange)] font-medium hover:underline"
              >
                Düzenle
              </button>
              {!a.isDefault && (
                <form action={setDefaultAddressAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="text-neutral-600 hover:text-neutral-900">
                    Varsayılan yap
                  </button>
                </form>
              )}
              <form action={deleteAddressAction} className="ml-auto">
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="text-red-600 hover:underline">
                  Sil
                </button>
              </form>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
