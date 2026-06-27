'use client';
import { useState } from 'react';
import { saveFooterAction } from '@/lib/actions/settings';
import type { FooterCol } from '@/app/(storefront)/_home/SiteFooter';

interface Init {
  footerCols: FooterCol[];
  footer_desc: string;
  footer_phone: string;
  footer_email: string;
  footer_address: string;
  footer_instagram: string;
}

export function FooterEditor({ init }: { init: Init }) {
  const [cols, setCols] = useState<FooterCol[]>(init.footerCols);
  const [c, setC] = useState({
    footer_desc: init.footer_desc, footer_phone: init.footer_phone, footer_email: init.footer_email,
    footer_address: init.footer_address, footer_instagram: init.footer_instagram,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const clone = (fn: (a: FooterCol[]) => void) => setCols((p) => { const n = structuredClone(p); fn(n); return n; });
  const save = async () => {
    setSaving(true);
    await saveFooterAction({ footerCols: cols, ...c });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const inp = 'h-9 w-full px-2.5 rounded-lg border border-neutral-300 text-sm outline-none focus:border-orange-500';
  const lbl = 'text-xs font-medium block mb-1 text-neutral-600';

  return (
    <div className="p-4 pt-0 border-t flex flex-col gap-4">
      <div className="flex justify-end -mb-2">
        <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-brand-ink,#14201d)] text-white font-medium disabled:opacity-50">
          {saving ? 'Kaydediliyor…' : saved ? '✓ Kaydedildi' : 'Footer\'ı kaydet'}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><label className={lbl}>Marka açıklaması</label><textarea value={c.footer_desc} onChange={(e) => setC({ ...c, footer_desc: e.target.value })} className={inp + ' h-16 py-1.5'} /></div>
        <div><label className={lbl}>Telefon</label><input value={c.footer_phone} onChange={(e) => setC({ ...c, footer_phone: e.target.value })} className={inp} /></div>
        <div><label className={lbl}>E-posta</label><input value={c.footer_email} onChange={(e) => setC({ ...c, footer_email: e.target.value })} className={inp} /></div>
        <div><label className={lbl}>Adres</label><input value={c.footer_address} onChange={(e) => setC({ ...c, footer_address: e.target.value })} className={inp} /></div>
        <div><label className={lbl}>Instagram URL</label><input value={c.footer_instagram} onChange={(e) => setC({ ...c, footer_instagram: e.target.value })} className={inp} /></div>
      </div>

      <div>
        <p className="text-xs font-semibold text-neutral-600 mb-2">Link sütunları</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {cols.map((col, ci) => (
            <div key={ci} className="border rounded-lg p-2 bg-neutral-50">
              <div className="flex items-center gap-1 mb-2">
                <input value={col.heading} onChange={(e) => clone((a) => { a[ci]!.heading = e.target.value; })} className="h-8 flex-1 px-2 rounded border border-neutral-200 text-xs font-semibold outline-none focus:border-orange-400" placeholder="Başlık" />
                <button onClick={() => clone((a) => a.splice(ci, 1))} className="text-neutral-400 hover:text-red-600 text-xs px-1" title="Sütunu sil">✕</button>
              </div>
              <div className="flex flex-col gap-1.5">
                {col.links.map((l, li) => (
                  <div key={li} className="flex gap-1">
                    <input value={l.label} onChange={(e) => clone((a) => { a[ci]!.links[li]!.label = e.target.value; })} className="h-7 flex-1 min-w-0 px-1.5 rounded border border-neutral-200 text-[11px] outline-none focus:border-orange-400" placeholder="Etiket" />
                    <input value={l.url} onChange={(e) => clone((a) => { a[ci]!.links[li]!.url = e.target.value; })} className="h-7 w-20 px-1.5 rounded border border-neutral-200 text-[11px] outline-none focus:border-orange-400" placeholder="/link" />
                    <button onClick={() => clone((a) => a[ci]!.links.splice(li, 1))} className="text-neutral-300 hover:text-red-600 text-[11px]">✕</button>
                  </div>
                ))}
                <button onClick={() => clone((a) => a[ci]!.links.push({ label: '', url: '/magaza' }))} className="text-[11px] py-1 rounded border border-dashed text-neutral-400 hover:text-orange-600">+ link</button>
              </div>
            </div>
          ))}
          <button onClick={() => clone((a) => a.push({ heading: 'Yeni Sütun', links: [] }))} className="border border-dashed rounded-lg text-sm text-neutral-400 hover:text-orange-600 hover:border-orange-400 min-h-24">+ Sütun ekle</button>
        </div>
      </div>
    </div>
  );
}
