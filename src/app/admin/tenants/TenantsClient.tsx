'use client';
/** Tenant listesi + ekle/düzenle formu (client). Server actions: lib/actions/tenants.ts */
import { useActionState, useState } from 'react';
import {
  createTenantAction,
  updateTenantAction,
  deleteTenantAction,
  type TenantActionResult,
} from '@/lib/actions/tenants';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  storefrontUrl: string;
  appUrl: string | null;
  shopifyDomain: string | null;
  dbName: string | null;
  status: string;
  notes: string | null;
  health: { ok: boolean; detail: string };
}

const STATUS_TR: Record<string, { label: string; cls: string }> = {
  active: { label: 'Canlı', cls: 'bg-green-100 text-green-700' },
  provisioning: { label: 'Kuruluyor', cls: 'bg-amber-100 text-amber-700' },
  disabled: { label: 'Durduruldu', cls: 'bg-gray-200 text-gray-600' },
};

function TenantForm({ tenant, onDone }: { tenant?: TenantRow; onDone: () => void }) {
  const action = tenant ? updateTenantAction : createTenantAction;
  const [state, formAction, pending] = useActionState<TenantActionResult | null, FormData>(action, null);

  if (state?.ok) onDone();

  const F = ({ name, label, def, req, ph }: { name: string; label: string; def?: string | null; req?: boolean; ph?: string }) => (
    <label className="block text-sm">
      <span className="text-gray-600">{label}{req ? ' *' : ''}</span>
      <input name={name} defaultValue={def ?? ''} required={req} placeholder={ph}
        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
    </label>
  );

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 bg-gray-50 border rounded-xl p-4 mb-4">
      {tenant && <input type="hidden" name="id" value={tenant.id} />}
      <F name="name" label="Marka adı" def={tenant?.name} req ph="Yeni Marka" />
      <F name="slug" label="Slug (değişmez kimlik)" def={tenant?.slug} req ph="yenimarka" />
      <F name="storefrontUrl" label="Storefront URL" def={tenant?.storefrontUrl} req ph="https://yenimarka.com" />
      <F name="appUrl" label="Instance/panel kökü (health)" def={tenant?.appUrl} ph="http://1.2.3.4 veya https://panel.yenimarka.com" />
      <F name="shopifyDomain" label="Shopify domain" def={tenant?.shopifyDomain} ph="xxxx.myshopify.com" />
      <F name="dbName" label="DB adı (envanter)" def={tenant?.dbName} ph="yenimarka" />
      <label className="block text-sm">
        <span className="text-gray-600">Durum</span>
        <select name="status" defaultValue={tenant?.status ?? 'provisioning'} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
          <option value="provisioning">Kuruluyor</option>
          <option value="active">Canlı</option>
          <option value="disabled">Durduruldu</option>
        </select>
      </label>
      <F name="notes" label="Notlar" def={tenant?.notes} ph="Tema id, KargoLab member, IBAN sahibi..." />
      <div className="col-span-2 flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
          {pending ? 'Kaydediliyor…' : tenant ? 'Güncelle' : 'Tenant Ekle'}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-gray-500">Vazgeç</button>
        {state?.error && <span className="text-sm text-red-600">⛔ {state.error}</span>}
      </div>
    </form>
  );
}

function DeleteButton({ id, slug }: { id: string; slug: string }) {
  const [state, formAction, pending] = useActionState<TenantActionResult | null, FormData>(deleteTenantAction, null);
  if (slug === 'viamood') return null;
  return (
    <form action={formAction} onSubmit={(e) => { if (!confirm(`"${slug}" kaydı silinsin mi? (Instance'a dokunmaz, sadece envanter kaydı)`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-xs text-red-500 hover:underline">Sil</button>
      {state?.error && <span className="text-xs text-red-600 ml-1">{state.error}</span>}
    </form>
  );
}

export function TenantsClient({ tenants: list }: { tenants: TenantRow[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <div>
      {editing === 'new' && <TenantForm onDone={() => setEditing(null)} />}
      {editing === null && (
        <button onClick={() => setEditing('new')} className="mb-4 bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          + Yeni Tenant
        </button>
      )}

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3">Marka</th>
              <th className="px-4 py-3">Storefront</th>
              <th className="px-4 py-3">Shopify</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Sağlık</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <>
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.slug}{t.dbName ? ` · db:${t.dbName}` : ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <a href={t.storefrontUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      {t.storefrontUrl.replace(/^https?:\/\//, '')}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.shopifyDomain ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_TR[t.status]?.cls ?? ''}`}>
                      {STATUS_TR[t.status]?.label ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={t.health.ok ? 'text-green-600' : 'text-red-500'}>
                      {t.health.ok ? '● ' : '○ '}{t.health.detail}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-3 justify-end items-center">
                      <button onClick={() => setEditing(t.id)} className="text-xs text-gray-500 hover:underline">Düzenle</button>
                      <DeleteButton id={t.id} slug={t.slug} />
                    </div>
                  </td>
                </tr>
                {editing === t.id && (
                  <tr key={`${t.id}-edit`}>
                    <td colSpan={6} className="px-4 pb-4">
                      <TenantForm tenant={t} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Not: Silme yalnız envanter kaydını kaldırır; instance/sunucu/DB&apos;ye dokunmaz. Ana kayıt (viamood) silinemez.
      </p>
    </div>
  );
}
