'use client';
import { useState } from 'react';
import { savePageAction } from '@/lib/actions/settings';

interface P { slug: string; title: string; html: string; overridden: boolean }

export function PageEditor({ pages }: { pages: P[] }) {
  const [sel, setSel] = useState(pages[0]?.slug ?? '');
  const [data, setData] = useState<Record<string, { title: string; html: string }>>(
    () => Object.fromEntries(pages.map((p) => [p.slug, { title: p.title, html: p.html }])),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const cur = data[sel];
  const set = (patch: Partial<{ title: string; html: string }>) =>
    setData((d) => ({ ...d, [sel]: { ...d[sel]!, ...patch } }));

  const save = async () => {
    if (!cur) return;
    setSaving(true);
    await savePageAction(sel, cur.title, cur.html);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-160px)] min-h-[560px]">
      {/* Sol: sayfa listesi */}
      <div className="w-56 shrink-0 bg-white rounded-xl border p-2 overflow-y-auto">
        {pages.map((p) => (
          <button key={p.slug} onClick={() => setSel(p.slug)} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${sel === p.slug ? 'bg-orange-50 ring-1 ring-orange-300' : 'hover:bg-neutral-50'}`}>
            <span className="truncate">{data[p.slug]?.title ?? p.title}</span>
            {p.overridden && <span className="text-[10px] text-orange-500" title="Düzenlenmiş">●</span>}
          </button>
        ))}
      </div>

      {/* Orta: editör */}
      <div className="flex-1 bg-white rounded-xl border p-4 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-neutral-500 font-mono">/sayfa/{sel}</span>
          <div className="flex items-center gap-2">
            <a href={`/sayfa/${sel}`} target="_blank" className="text-xs text-orange-600 hover:underline">Önizle ↗</a>
            <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-brand-ink,#14201d)] text-white font-medium disabled:opacity-50">
              {saving ? 'Kaydediliyor…' : saved ? '✓ Kaydedildi' : 'Kaydet'}
            </button>
          </div>
        </div>
        <label className="text-xs font-medium text-neutral-600 mb-1">Başlık</label>
        <input value={cur?.title ?? ''} onChange={(e) => set({ title: e.target.value })} className="h-10 w-full px-3 mb-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-orange-500" />
        <label className="text-xs font-medium text-neutral-600 mb-1">İçerik (HTML)</label>
        <textarea value={cur?.html ?? ''} onChange={(e) => set({ html: e.target.value })} className="flex-1 w-full p-3 rounded-lg border border-neutral-300 text-xs font-mono outline-none focus:border-orange-500 resize-none" spellCheck={false} />
      </div>

      {/* Sağ: canlı önizleme */}
      <div className="w-96 shrink-0 bg-white rounded-xl border overflow-y-auto">
        <div className="px-4 py-2 border-b text-xs text-neutral-500">Önizleme</div>
        <div className="p-5">
          <h1 className="text-xl font-bold mb-3">{cur?.title}</h1>
          {/* eslint-disable-next-line react/no-danger */}
          <div className="prose prose-sm max-w-none [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 [&_a]:text-orange-600 [&_a]:underline text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: cur?.html ?? '' }} />
        </div>
      </div>
    </div>
  );
}
