'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ProductImageGallery } from '@/components/products/ProductImageGallery';
import { VariantEditor, type OptionDef, type VariantRow } from '@/components/products/VariantEditor';
import type { ActionResult } from '@/lib/actions/auth';

interface ProductFormDefaults {
  title?: string;
  description?: string;
  productType?: string;
  tags?: string;
  status?: 'draft' | 'active' | 'archived';
  sku?: string;
  barcode?: string;
  price?: string;
  compareAtPrice?: string;
  cost?: string;
  weightGrams?: string;
  initialStock?: string;
  featuredImageUrl?: string;
}

interface ProductFormProps {
  defaults?: ProductFormDefaults;
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  showInitialStock?: boolean;
  /** Admin modu: verilirse Genel bölümünün başında tedarikçi seçici çıkar. */
  vendors?: { id: string; name: string }[];
  defaultVendorId?: string;
  /** 'gallery' → sürükle-bırak çoklu görsel galerisi; 'single' → tek URL input (varsayılan). */
  imageMode?: 'single' | 'gallery';
  defaultImages?: string[];
  /** Çoklu varyant başlangıç durumu (edit modunda mevcut varyantlar). */
  defaultHasVariants?: boolean;
  defaultOptions?: OptionDef[];
  defaultVariants?: VariantRow[];
}

export function ProductForm({ defaults = {}, action, submitLabel, showInitialStock = true, vendors, defaultVendorId, imageMode = 'single', defaultImages = [], defaultHasVariants = false, defaultOptions, defaultVariants }: ProductFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const fieldErrors = state && !state.success ? state.fieldErrors ?? {} : {};
  const [hasVariants, setHasVariants] = useState(defaultHasVariants);

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-3xl">
      <section className="bg-white rounded-xl border p-6 flex flex-col gap-4">
        <h2 className="font-bold border-b pb-2">Genel</h2>
        {vendors && (
          <div>
            <label htmlFor="vendorId" className="text-sm font-medium text-neutral-800 block mb-1.5">
              Tedarikçi <span className="text-red-500">*</span>
            </label>
            <select
              id="vendorId"
              name="vendorId"
              required
              defaultValue={defaultVendorId ?? ''}
              className="h-11 w-full px-4 rounded-lg border border-neutral-300 bg-white text-[15px] outline-none focus:border-[var(--color-brand-orange)] focus:ring-2 focus:ring-[var(--color-brand-orange)]/20"
            >
              <option value="" disabled>— Tedarikçi seç —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">Ürün bu tedarikçinin adına oluşturulur.</p>
          </div>
        )}
        <Input
          name="title"
          label="Başlık"
          placeholder="Örn: Stoklu Saklama Kabı 5'li Set"
          required
          defaultValue={defaults.title}
          error={fieldErrors.title}
        />
        <Textarea
          name="description"
          label="Açıklama"
          rows={6}
          placeholder="Ürün özelliklerini ve faydalarını yaz..."
          defaultValue={defaults.description}
          error={fieldErrors.description}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            name="productType"
            label="Ürün tipi"
            placeholder="Saklama Kabı"
            defaultValue={defaults.productType}
            error={fieldErrors.productType}
          />
          <div>
            <label htmlFor="status" className="text-sm font-medium text-neutral-800 block mb-1.5">
              Durum
            </label>
            <select
              id="status"
              name="status"
              defaultValue={defaults.status ?? 'draft'}
              className="h-11 w-full px-4 rounded-lg border border-neutral-300 bg-white text-[15px] outline-none focus:border-[var(--color-brand-orange)] focus:ring-2 focus:ring-[var(--color-brand-orange)]/20"
            >
              <option value="draft">Taslak (sadece sen görürsün)</option>
              <option value="active">Yayında</option>
              <option value="archived">Arşiv</option>
            </select>
          </div>
        </div>
        <Input
          name="tags"
          label="Etiketler"
          placeholder="mutfak, saklama, organizer"
          hint="Virgül ile ayır"
          defaultValue={defaults.tags}
          error={fieldErrors.tags}
        />
        {imageMode === 'gallery' ? (
          <div>
            <label className="text-sm font-medium text-neutral-800 block mb-1.5">Görseller</label>
            <ProductImageGallery defaultImages={defaultImages} />
          </div>
        ) : (
          <Input
            name="featuredImageUrl"
            label="Öne çıkan görsel URL"
            placeholder="https://..."
            hint="Phase 2.2'de dosya yükleme gelecek. Şimdilik dış URL."
            defaultValue={defaults.featuredImageUrl}
            error={fieldErrors.featuredImageUrl}
          />
        )}
      </section>

      <section className="bg-white rounded-xl border p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="font-bold">Fiyat & Stok</h2>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={hasVariants}
              onChange={(e) => setHasVariants(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-brand-orange)]"
            />
            Bu üründe seçenekler var (beden, renk…)
          </label>
        </div>
        <input type="hidden" name="useVariants" value={hasVariants ? '1' : '0'} />

        {hasVariants ? (
          <>
            <VariantEditor basePrice={defaults.price} defaultOptions={defaultOptions} defaultVariants={defaultVariants} />
            <Input
              name="weightGrams"
              label="Ağırlık (gram) — tüm varyantlar için"
              type="number"
              min="0"
              placeholder="500"
              defaultValue={defaults.weightGrams}
              error={fieldErrors.weightGrams}
            />
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Input name="price" label="Satış fiyatı (TL)" type="number" step="0.01" min="0" required defaultValue={defaults.price} error={fieldErrors.priceCents} />
              <Input name="compareAtPrice" label="Eski fiyat (TL)" type="number" step="0.01" min="0" hint="İndirim göstermek için" defaultValue={defaults.compareAtPrice} error={fieldErrors.compareAtPriceCents} />
              <Input name="cost" label="Maliyet (TL)" type="number" step="0.01" min="0" hint="Sadece sen görürsün" defaultValue={defaults.cost} error={fieldErrors.costCents} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input name="sku" label="SKU" placeholder="VM-001" defaultValue={defaults.sku} error={fieldErrors.sku} />
              <Input name="barcode" label="Barkod" placeholder="8690000000000" defaultValue={defaults.barcode} error={fieldErrors.barcode} />
              <Input name="weightGrams" label="Ağırlık (gram)" type="number" min="0" placeholder="500" defaultValue={defaults.weightGrams} error={fieldErrors.weightGrams} />
            </div>
            {showInitialStock && (
              <Input name="initialStock" label="Başlangıç stoğu" type="number" min="0" placeholder="0" hint="Sonradan stok ekranından güncelleyebilirsin" defaultValue={defaults.initialStock ?? '0'} error={fieldErrors.initialStock} />
            )}
          </>
        )}
      </section>

      {state && !state.success && !state.fieldErrors && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✓ Kaydedildi
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="submit" loading={pending} size="lg">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
