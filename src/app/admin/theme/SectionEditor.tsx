'use client';
import { useState } from 'react';
import {
  SECTION_DEFS,
  type Field,
  type HomeSection,
  type SectionType,
} from '@/lib/storefront/sections';
import { saveHomeSectionsAction } from '@/lib/actions/settings';

const ALL_TYPES = Object.keys(SECTION_DEFS) as SectionType[];

export function SectionEditor({ initial }: { initial: HomeSection[] }) {
  const [sections, setSections] = useState<HomeSection[]>(initial);
  const [selId, setSelId] = useState<string | null>(initial[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [adding, setAdding] = useState(false);

  const sel = sections.find((s) => s.id === selId) ?? null;

  const mutate = (fn: (arr: HomeSection[]) => void) =>
    setSections((prev) => {
      const next = structuredClone(prev) as HomeSection[];
      fn(next);
      return next;
    });

  const move = (id: string, dir: -1 | 1) =>
    mutate((arr) => {
      const i = arr.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return;
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    });
  const toggle = (id: string) => mutate((arr) => { const s = arr.find((x) => x.id === id); if (s) s.visible = !s.visible; });
  const remove = (id: string) => { mutate((arr) => { const i = arr.findIndex((s) => s.id === id); if (i >= 0) arr.splice(i, 1); }); if (selId === id) setSelId(null); };
  const add = (type: SectionType) => {
    const id = `${type}-${Date.now()}`;
    mutate((arr) => arr.push({ id, type, visible: true, settings: {} }));
    setSelId(id);
    setAdding(false);
  };
  const setField = (key: string, val: unknown) =>
    mutate((arr) => { const s = arr.find((x) => x.id === selId); if (s) s.settings = { ...s.settings, [key]: val }; });
  const setItem = (key: string, idx: number, itemKey: string, val: unknown) =>
    mutate((arr) => {
      const s = arr.find((x) => x.id === selId);
      if (!s) return;
      const list = Array.isArray(s.settings[key]) ? [...(s.settings[key] as Record<string, unknown>[])] : [];
      list[idx] = { ...(list[idx] ?? {}), [itemKey]: val };
      s.settings = { ...s.settings, [key]: list };
    });
  const addItem = (key: string) =>
    mutate((arr) => { const s = arr.find((x) => x.id === selId); if (!s) return; const list = Array.isArray(s.settings[key]) ? [...(s.settings[key] as unknown[])] : []; list.push({}); s.settings = { ...s.settings, [key]: list }; });
  const removeItem = (key: string, idx: number) =>
    mutate((arr) => { const s = arr.find((x) => x.id === selId); if (!s) return; const list = Array.isArray(s.settings[key]) ? [...(s.settings[key] as unknown[])] : []; list.splice(idx, 1); s.settings = { ...s.settings, [key]: list }; });

  const save = async () => {
    setSaving(true);
    const r = await saveHomeSectionsAction(JSON.stringify(sections));
    setSaving(false);
    if (r.ok) { setSaved(true); setPreviewKey((k) => k + 1); setTimeout(() => setSaved(false), 2500); }
    else alert('Kaydedilemedi: ' + (r.error ?? ''));
  };

  const inp = 'h-10 w-full px-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-orange-500';

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[600px]">
      {/* Sol: section listesi */}
      <div className="w-72 shrink-0 bg-white rounded-xl border flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="font-semibold text-sm">Bölümler</span>
          <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-brand-ink,#14201d)] text-white font-medium disabled:opacity-50">
            {saving ? 'Kaydediliyor…' : saved ? '✓ Kaydedildi' : 'Kaydet'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sections.map((s) => (
            <div key={s.id} className={`group flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer ${selId === s.id ? 'bg-orange-50 ring-1 ring-orange-300' : 'hover:bg-neutral-50'}`} onClick={() => setSelId(s.id)}>
              <span className="text-base">{SECTION_DEFS[s.type].icon}</span>
              <span className={`flex-1 text-sm truncate ${s.visible ? '' : 'text-neutral-400 line-through'}`}>{SECTION_DEFS[s.type].label}</span>
              <button onClick={(e) => { e.stopPropagation(); move(s.id, -1); }} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-black px-1" title="Yukarı">▲</button>
              <button onClick={(e) => { e.stopPropagation(); move(s.id, 1); }} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-black px-1" title="Aşağı">▼</button>
              <button onClick={(e) => { e.stopPropagation(); toggle(s.id); }} className="text-neutral-400 hover:text-black px-1" title={s.visible ? 'Gizle' : 'Göster'}>{s.visible ? '👁️' : '🚫'}</button>
              <button onClick={(e) => { e.stopPropagation(); remove(s.id); }} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-600 px-1" title="Sil">✕</button>
            </div>
          ))}
        </div>
        <div className="p-2 border-t relative">
          <button onClick={() => setAdding((a) => !a)} className="w-full text-sm py-2 rounded-lg border border-dashed border-neutral-300 text-neutral-600 hover:border-orange-400 hover:text-orange-600">+ Bölüm ekle</button>
          {adding && (
            <div className="absolute bottom-14 left-2 right-2 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
              {ALL_TYPES.map((t) => (
                <button key={t} onClick={() => add(t)} className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2">
                  <span>{SECTION_DEFS[t].icon}</span> {SECTION_DEFS[t].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Orta: ayarlar */}
      <div className="w-80 shrink-0 bg-white rounded-xl border overflow-y-auto">
        {sel ? (
          <div className="p-4">
            <h3 className="font-semibold text-sm border-b pb-2 mb-3 flex items-center gap-2">{SECTION_DEFS[sel.type].icon} {SECTION_DEFS[sel.type].label}</h3>
            <div className="flex flex-col gap-3">
              {SECTION_DEFS[sel.type].fields.map((f) => (
                <FieldInput key={f.key} field={f} section={sel} inp={inp} onChange={(v) => setField(f.key, v)} onItem={setItem} onAddItem={addItem} onRemoveItem={removeItem} />
              ))}
              {SECTION_DEFS[sel.type].fields.length === 0 && <p className="text-sm text-neutral-400">Bu bölümün ayarı yok.</p>}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-neutral-400">Soldan bir bölüm seç</div>
        )}
      </div>

      {/* Sağ: canlı önizleme */}
      <div className="flex-1 bg-white rounded-xl border overflow-hidden flex flex-col">
        <div className="px-4 py-2 border-b text-xs text-neutral-500 flex items-center justify-between">
          <span>Önizleme (kaydedince güncellenir)</span>
          <a href="/" target="_blank" className="text-orange-600 hover:underline">Yeni sekmede aç ↗</a>
        </div>
        <iframe key={previewKey} src="/" className="flex-1 w-full" title="Önizleme" />
      </div>
    </div>
  );
}

function FieldInput({
  field, section, inp, onChange, onItem, onAddItem, onRemoveItem,
}: {
  field: Field; section: HomeSection; inp: string;
  onChange: (v: unknown) => void;
  onItem: (key: string, idx: number, itemKey: string, val: unknown) => void;
  onAddItem: (key: string) => void;
  onRemoveItem: (key: string, idx: number) => void;
}) {
  const val = section.settings[field.key];
  const lbl = 'text-xs font-medium block mb-1 text-neutral-600';

  if (field.type === 'repeater') {
    const items = Array.isArray(val) ? (val as Record<string, unknown>[]) : [];
    return (
      <div>
        <label className={lbl}>{field.label}</label>
        <div className="flex flex-col gap-2">
          {items.map((it, idx) => (
            <div key={idx} className="border rounded-lg p-2 bg-neutral-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-neutral-500">{field.itemLabel} {idx + 1}</span>
                <button onClick={() => onRemoveItem(field.key, idx)} className="text-neutral-400 hover:text-red-600 text-xs">Sil</button>
              </div>
              <div className="flex flex-col gap-1.5">
                {field.itemFields?.map((itf) => (
                  <input key={itf.key} className="h-8 w-full px-2 rounded border border-neutral-200 text-xs outline-none focus:border-orange-400" placeholder={itf.label}
                    value={String(it[itf.key] ?? '')} onChange={(e) => onItem(field.key, idx, itf.key, e.target.value)} />
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => onAddItem(field.key)} className="text-xs py-1.5 rounded-lg border border-dashed text-neutral-500 hover:text-orange-600 hover:border-orange-400">+ {field.itemLabel} ekle</button>
        </div>
      </div>
    );
  }
  if (field.type === 'toggle') {
    return (
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={!!val} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-orange-500" /> {field.label}
      </label>
    );
  }
  if (field.type === 'textarea') {
    return (
      <div><label className={lbl}>{field.label}</label>
        <textarea className={inp + ' h-20 py-2'} value={String(val ?? '')} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  return (
    <div>
      <label className={lbl}>{field.label}</label>
      <input type={field.type === 'number' ? 'number' : 'text'} className={inp} value={String(val ?? '')} onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)} />
      {field.type === 'image' && val ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={String(val)} alt="" className="mt-1.5 h-16 rounded border object-cover" />
      ) : null}
    </div>
  );
}
