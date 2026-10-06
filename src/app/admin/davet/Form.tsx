'use client';

import { useActionState } from 'react';
import { davetOlusturAction, type DavetOlusturDurum } from '@/lib/actions/davet-olustur';

const girdiCls = 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm leading-relaxed';

export function DavetOlusturForm({ roller }: { roller: string[] }) {
  const [durum, formAction, pending] = useActionState<DavetOlusturDurum | null, FormData>(
    davetOlusturAction,
    null,
  );

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4 rounded-2xl border bg-white p-6">
        <div>
          <label htmlFor="d-email" className="mb-1 block text-xs font-medium leading-relaxed">E-posta</label>
          <input id="d-email" name="email" type="email" required className={girdiCls} placeholder="ornek@site.com" />
        </div>
        <div>
          <label htmlFor="d-rol" className="mb-1 block text-xs font-medium leading-relaxed">Rol</label>
          <select id="d-rol" name="role" required className={girdiCls} defaultValue="sss_editor">
            {roller.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm leading-relaxed">
          <input type="checkbox" name="mailGonder" defaultChecked className="h-4 w-4" />
          Davet e-postasını da gönder
        </label>
        <button type="submit" disabled={pending}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium leading-relaxed text-white disabled:opacity-60">
          {pending ? 'Üretiliyor…' : 'Davet linki üret'}
        </button>
      </form>

      {durum && !durum.ok && (
        <p className="text-sm leading-relaxed text-red-600">{durum.hata}</p>
      )}
      {durum?.ok && (
        <div className="rounded-2xl border bg-white p-6">
          <p className="mb-2 text-xs font-medium leading-relaxed text-neutral-600">
            Link bir kez gösterilir — şimdi kopyala. Geçerlilik: {new Date(durum.expiresAt).toLocaleString('tr-TR')}
          </p>
          <textarea readOnly rows={3} className={`${girdiCls} font-mono`} value={durum.link} />
          <p className="mt-3 text-xs leading-relaxed text-neutral-600">
            {durum.mail === 'gonderildi' && 'E-posta gönderildi.'}
            {durum.mail === 'gonderilmedi' && 'E-posta gönderilmedi — linki elden ilet.'}
            {durum.mail === 'basarisiz' &&
              `E-posta GÖNDERİLEMEDİ${durum.mailNot ? ` (${durum.mailNot})` : ''} — link yine de geçerli, elden ilet.`}
          </p>
        </div>
      )}
    </div>
  );
}
