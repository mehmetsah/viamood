'use client';
import { useState } from 'react';
import { saveMenuAction } from '@/lib/actions/settings';
import { DEFAULT_NAV_ICON, type NavItem } from '@/app/(storefront)/_home/assets';

export function MenuEditor({ initial }: { initial: NavItem[] }) {
  const [nav, setNav] = useState<NavItem[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const mut = (fn: (a: NavItem[]) => void) => setNav((p) => { const n = structuredClone(p) as NavItem[]; fn(n); return n; });
  const save = async () => {
    setSaving(true);
    const r = await saveMenuAction(JSON.stringify(nav));
    setSaving(false);
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); } else alert('Hata: ' + (r.error ?? ''));
  };

  const inS = 'h-8 px-2 rounded border border-neutral-200 text-xs outline-none focus:border-orange-400';

  return (
    <div className="p-4 pt-0 border-t">
      <div className="flex justify-end mb-3">
        <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-brand-ink,#14201d)] text-white font-medium disabled:opacity-50">
          {saving ? 'Kaydediliyor…' : saved ? '✓ Kaydedildi' : 'Menüyü kaydet'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {nav.map((item, i) => (
          <div key={i} className="border rounded-lg p-3 bg-neutral-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-neutral-400 w-5">{i + 1}.</span>
              <input value={item.label} onChange={(e) => mut((a) => { a[i]!.label = e.target.value; })} className={inS + ' flex-1 font-semibold'} placeholder="Menü adı" />
              <input value={item.url} onChange={(e) => mut((a) => { a[i]!.url = e.target.value; })} className={inS + ' w-28'} placeholder="/link" />
              <button onClick={() => mut((a) => { if (i > 0) { const t = a[i]!; a[i] = a[i - 1]!; a[i - 1] = t; } })} className="text-neutral-400 hover:text-black text-xs px-0.5" title="Yukarı">▲</button>
              <button onClick={() => mut((a) => { if (i < a.length - 1) { const t = a[i]!; a[i] = a[i + 1]!; a[i + 1] = t; } })} className="text-neutral-400 hover:text-black text-xs px-0.5" title="Aşağı">▼</button>
              <button onClick={() => mut((a) => a.splice(i, 1))} className="text-neutral-400 hover:text-red-600 text-xs px-0.5" title="Sil">✕</button>
            </div>

            {/* Mega kolonlar */}
            <div className="pl-7 flex flex-col gap-2">
              {(item.mega ?? []).map((col, ci) => (
                <div key={ci} className="border-l-2 border-orange-200 pl-2">
                  <div className="flex items-center gap-1 mb-1">
                    <input value={col.heading} onChange={(e) => mut((a) => { a[i]!.mega![ci]!.heading = e.target.value; })} className={inS + ' flex-1 font-medium'} placeholder="Sütun başlığı" />
                    <button onClick={() => mut((a) => { a[i]!.mega!.splice(ci, 1); if (!a[i]!.mega!.length) delete a[i]!.mega; })} className="text-neutral-400 hover:text-red-600 text-[11px]">sütun sil</button>
                  </div>
                  <div className="flex flex-col gap-1 pl-2">
                    {col.links.map((l, li) => (
                      <div key={li} className="flex gap-1">
                        <input value={l.label} onChange={(e) => mut((a) => { a[i]!.mega![ci]!.links[li]!.label = e.target.value; })} className={inS + ' flex-1 min-w-0 h-7 text-[11px]'} placeholder="Etiket" />
                        <input value={l.url} onChange={(e) => mut((a) => { a[i]!.mega![ci]!.links[li]!.url = e.target.value; })} className={inS + ' w-24 h-7 text-[11px]'} placeholder="/link" />
                        <button onClick={() => mut((a) => a[i]!.mega![ci]!.links.splice(li, 1))} className="text-neutral-300 hover:text-red-600 text-[11px]">✕</button>
                      </div>
                    ))}
                    <button onClick={() => mut((a) => a[i]!.mega![ci]!.links.push({ label: '', url: '/magaza' }))} className="text-[11px] text-neutral-400 hover:text-orange-600 text-left">+ link</button>
                  </div>
                </div>
              ))}
              <button onClick={() => mut((a) => { if (!a[i]!.mega) a[i]!.mega = []; a[i]!.mega!.push({ heading: 'Yeni Sütun', links: [] }); })} className="text-[11px] text-neutral-400 hover:text-orange-600 text-left">+ mega sütun ekle</button>
            </div>
          </div>
        ))}
        <button onClick={() => mut((a) => a.push({ label: 'Yeni Menü', url: '/magaza', icon: DEFAULT_NAV_ICON }))} className="text-sm py-2 rounded-lg border border-dashed text-neutral-500 hover:text-orange-600 hover:border-orange-400">+ Menü öğesi ekle</button>
      </div>
      <p className="text-[11px] text-neutral-400 mt-2">Not: Menü ikonları (SVG) düzenlenmez; mevcut öğelerin ikonu korunur, yeni öğeler varsayılan ikon alır.</p>
    </div>
  );
}
