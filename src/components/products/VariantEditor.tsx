'use client';

import { useMemo, useState } from 'react';

/** Seçenek tanımı: ad (Beden) + değerler (S, M, L). */
export interface OptionDef {
  name: string;
  values: string[];
}
/** Tek varyant satırı (kombinasyon + fiyat/sku/stok). */
export interface VariantRow {
  id?: string; // mevcut varyant (edit) — yeni satırda yok
  options: string[]; // option değerleri sırasıyla (option1, option2, option3)
  price: string;
  sku: string;
  stock: string;
  barcode?: string;
}

interface Props {
  defaultOptions?: OptionDef[];
  defaultVariants?: VariantRow[];
  basePrice?: string; // tekli fiyat — yeni üretilen satırlara varsayılan
}

const sig = (vals: string[]) => vals.join(' / ');

function cartesian(options: OptionDef[]): string[][] {
  const valueLists = options.map((o) => o.values.filter((v) => v.trim() !== ''));
  if (valueLists.some((l) => l.length === 0)) return [];
  return valueLists.reduce<string[][]>(
    (acc, list) => acc.flatMap((combo) => list.map((v) => [...combo, v])),
    [[]],
  );
}

export function VariantEditor({ defaultOptions, defaultVariants, basePrice }: Props) {
  const [options, setOptions] = useState<OptionDef[]>(
    defaultOptions && defaultOptions.length ? defaultOptions : [{ name: '', values: [] }],
  );
  // Varyant override'ları kombinasyon imzasına göre saklanır (option değişince korunur)
  const [overrides, setOverrides] = useState<Record<string, VariantRow>>(() => {
    const m: Record<string, VariantRow> = {};
    for (const v of defaultVariants ?? []) m[sig(v.options)] = v;
    return m;
  });

  const combos = useMemo(() => cartesian(options), [options]);

  const variants: VariantRow[] = combos.map((combo) => {
    const key = sig(combo);
    const ov = overrides[key];
    return {
      id: ov?.id,
      options: combo,
      price: ov?.price ?? basePrice ?? '',
      sku: ov?.sku ?? '',
      stock: ov?.stock ?? '0',
      barcode: ov?.barcode,
    };
  });

  const setOverride = (combo: string[], patch: Partial<VariantRow>) => {
    const key = sig(combo);
    setOverrides((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { options: combo, price: basePrice ?? '', sku: '', stock: '0' }), options: combo, ...patch },
    }));
  };

  const updateOptionName = (i: number, name: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, name } : o)));
  const updateOptionValues = (i: number, raw: string) =>
    setOptions((prev) =>
      prev.map((o, idx) =>
        idx === i ? { ...o, values: raw.split(',').map((s) => s.trim()).filter(Boolean) } : o,
      ),
    );
  const addOption = () => options.length < 3 && setOptions((prev) => [...prev, { name: '', values: [] }]);
  const removeOption = (i: number) => setOptions((prev) => prev.filter((_, idx) => idx !== i));

  const inputCls =
    'h-10 w-full px-3 rounded-lg border border-neutral-300 bg-white text-sm outline-none focus:border-[var(--color-brand-orange)] focus:ring-2 focus:ring-[var(--color-brand-orange)]/20';

  const cleanOptions = options
    .map((o) => ({ name: o.name.trim(), values: o.values }))
    .filter((o) => o.name && o.values.length);

  return (
    <div className="flex flex-col gap-4">
      {/* Seçenekler */}
      <div className="flex flex-col gap-3">
        {options.map((opt, i) => (
          <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end">
            <div>
              {i === 0 && <label className="text-xs text-neutral-500 block mb-1">Seçenek adı</label>}
              <input
                className={inputCls}
                placeholder="Beden"
                value={opt.name}
                onChange={(e) => updateOptionName(i, e.target.value)}
              />
            </div>
            <div>
              {i === 0 && <label className="text-xs text-neutral-500 block mb-1">Değerler (virgülle)</label>}
              <input
                className={inputCls}
                placeholder="S, M, L, XL"
                defaultValue={opt.values.join(', ')}
                onChange={(e) => updateOptionValues(i, e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => removeOption(i)}
              className="h-10 px-3 text-sm text-red-600 hover:bg-red-50 rounded-lg"
              title="Seçeneği kaldır"
            >
              ✕
            </button>
          </div>
        ))}
        {options.length < 3 && (
          <button
            type="button"
            onClick={addOption}
            className="self-start text-sm text-[var(--color-brand-orange)] font-medium hover:underline"
          >
            + Seçenek ekle ({options.length}/3)
          </button>
        )}
      </div>

      {/* Varyant tablosu */}
      {variants.length > 0 ? (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Varyant</th>
                <th className="text-left px-3 py-2 font-medium w-32">Fiyat (TL)</th>
                <th className="text-left px-3 py-2 font-medium w-36">SKU</th>
                <th className="text-left px-3 py-2 font-medium w-24">Stok</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={sig(v.options)} className="border-t">
                  <td className="px-3 py-2 font-medium">{sig(v.options)}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={inputCls}
                      value={v.price}
                      onChange={(e) => setOverride(v.options, { price: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputCls}
                      value={v.sku}
                      placeholder="VM-S-KRM"
                      onChange={(e) => setOverride(v.options, { sku: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={v.stock}
                      onChange={(e) => setOverride(v.options, { stock: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          Seçenek adı + en az bir değer gir; varyant satırları otomatik oluşur.
        </p>
      )}

      {/* Server action'a JSON olarak taşı */}
      <input type="hidden" name="optionsJson" value={JSON.stringify(cleanOptions)} />
      <input type="hidden" name="variantsJson" value={JSON.stringify(variants)} />
    </div>
  );
}
