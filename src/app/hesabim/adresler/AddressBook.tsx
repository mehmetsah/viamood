'use client';

import { useState } from 'react';
import {
  addAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
} from '@/lib/actions/customer';
import { AddressForm, type AddressInit } from './AddressForm';

export interface AddressDTO extends AddressInit {
  id: string;
}

export function AddressBook({ addresses }: { addresses: AddressDTO[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  if (editing === 'new') {
    return (
      <div className="vh-kart" style={{ padding: 20 }}>
        <AddressForm
          action={addAddressAction}
          submitLabel="Adresi kaydet"
          onDone={() => setEditing(null)}
        />
      </div>
    );
  }

  const duzenlenen = addresses.find((a) => a.id === editing);
  if (duzenlenen) {
    return (
      <div className="vh-kart" style={{ padding: 20 }}>
        <AddressForm
          action={updateAddressAction}
          initial={duzenlenen}
          submitLabel="Değişiklikleri kaydet"
          onDone={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="vh-adres-izgara">
      {addresses.map((a) => (
        <div className="vh-kart vh-adres" key={a.id}>
          {a.isDefault && <span className="vh-vars">Varsayılan</span>}
          <div className="tur">
            <span className="vh-cati" aria-hidden="true" />
            {a.label || 'Adres'}
          </div>
          <p>
            <b>{[a.firstName, a.lastName].filter(Boolean).join(' ') || '—'}</b>
            {a.phone ? ` · ${a.phone}` : ''}
            <br />
            {a.address1}
            <br />
            {[a.neighborhood, a.district, a.province].filter(Boolean).join(' / ')}
            {a.postalCode ? ` · ${a.postalCode}` : ''}
          </p>
          <div className="a-alt">
            <button className="vh-btn vh-btn-sessiz" onClick={() => setEditing(a.id)}>
              Düzenle
            </button>
            <form action={deleteAddressAction}>
              <input type="hidden" name="id" value={a.id} />
              <button type="submit" className="vh-btn vh-btn-sessiz">
                Sil
              </button>
            </form>
            {!a.isDefault && (
              <form action={setDefaultAddressAction}>
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  className="vh-btn vh-btn-sessiz"
                  style={{ color: 'var(--vh-iyi)' }}
                >
                  Varsayılan yap
                </button>
              </form>
            )}
          </div>
        </div>
      ))}

      <button className="vh-adres-yeni" onClick={() => setEditing('new')}>
        + Yeni adres ekle
      </button>
    </div>
  );
}
