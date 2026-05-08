'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createTestOrderAction } from '@/lib/actions/order-test';

interface VariantOption {
  variantId: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  priceCents: number;
  vendorId: string;
  vendorName: string;
}

interface Line {
  variantId: string;
  quantity: number;
}

interface Props {
  variants: VariantOption[];
}

export function TestOrderForm({ variants }: Props) {
  const [lines, setLines] = useState<Line[]>([{ variantId: variants[0]?.variantId ?? '', quantity: 1 }]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((cur) => cur.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((cur) => [...cur, { variantId: variants[0]?.variantId ?? '', quantity: 1 }]);
  }

  function removeLine(idx: number) {
    setLines((cur) => cur.filter((_, i) => i !== idx));
  }

  // Subtotal preview
  const subtotalCents = lines.reduce((sum, l) => {
    const v = variants.find((x) => x.variantId === l.variantId);
    return sum + (v ? v.priceCents * l.quantity : 0);
  }, 0);

  return (
    <form action={createTestOrderAction} className="flex flex-col gap-6">
      <section className="bg-white rounded-xl border p-6 flex flex-col gap-4">
        <h2 className="font-bold border-b pb-2">Müşteri</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input name="customerName" label="Ad Soyad" required defaultValue="Test Müşteri" />
          <Input name="customerEmail" type="email" label="E-posta" required defaultValue="test@example.com" />
        </div>
        <Input name="customerPhone" label="Telefon" defaultValue="0555 555 55 55" />
      </section>

      <section className="bg-white rounded-xl border p-6 flex flex-col gap-4">
        <h2 className="font-bold border-b pb-2">Teslimat Adresi</h2>
        <Input name="addressLine1" label="Adres" required defaultValue="Test Mh. Test Sk. No:1" />
        <div className="grid grid-cols-3 gap-4">
          <Input name="city" label="İl" required defaultValue="İstanbul" />
          <Input name="district" label="İlçe" required defaultValue="Beyoğlu" />
          <Input name="postalCode" label="Posta kodu" defaultValue="34433" />
        </div>
        <Input name="shipping" type="number" step="0.01" label="Kargo bedeli (₺)" defaultValue="0" />
      </section>

      <section className="bg-white rounded-xl border p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="font-bold">Ürünler</h2>
          <button type="button" onClick={addLine} className="text-sm text-[var(--color-brand-orange)] font-semibold">
            + Satır ekle
          </button>
        </div>
        {lines.map((line, idx) => {
          const v = variants.find((x) => x.variantId === line.variantId);
          const lineTotal = (v?.priceCents ?? 0) * line.quantity;
          return (
            <div key={idx} className="flex gap-3 items-end">
              <input type="hidden" name={`lineItems[${idx}].variantId`} value={line.variantId} />
              <input type="hidden" name={`lineItems[${idx}].quantity`} value={line.quantity} />
              <div className="flex-1">
                <label className="text-xs text-neutral-600">Ürün</label>
                <select
                  value={line.variantId}
                  onChange={(e) => updateLine(idx, { variantId: e.target.value })}
                  className="w-full h-10 px-3 border rounded-lg text-sm bg-white"
                >
                  {variants.map((opt) => (
                    <option key={opt.variantId} value={opt.variantId}>
                      [{opt.vendorName}] {opt.productTitle}
                      {opt.sku ? ` · ${opt.sku}` : ''} — {(opt.priceCents / 100).toFixed(2)} ₺
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs text-neutral-600">Adet</label>
                <input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) => updateLine(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                  className="w-full h-10 px-3 border rounded-lg text-sm"
                />
              </div>
              <div className="w-28 text-right">
                <div className="text-xs text-neutral-600">Tutar</div>
                <div className="h-10 leading-10 font-mono">{(lineTotal / 100).toFixed(2)} ₺</div>
              </div>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="h-10 px-3 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        <div className="border-t pt-3 flex justify-end items-center gap-3 text-sm">
          <span className="text-neutral-600">Ara toplam:</span>
          <span className="text-lg font-bold font-mono">{(subtotalCents / 100).toFixed(2)} ₺</span>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" size="lg">
          Sipariş yarat ve route et
        </Button>
      </div>
    </form>
  );
}
