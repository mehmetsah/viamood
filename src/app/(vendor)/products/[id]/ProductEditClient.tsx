'use client';

import { ProductForm } from '@/components/products/ProductForm';
import { deleteProductAction, updateProductAction } from '@/lib/actions/product';
import type { ActionResult } from '@/lib/actions/auth';

interface Props {
  productId: string;
  defaults: Parameters<typeof ProductForm>[0]['defaults'];
}

export function ProductEditClient({ productId, defaults }: Props) {
  const action = async (_prev: ActionResult | null, formData: FormData) =>
    updateProductAction(productId, formData);

  return (
    <div className="space-y-8">
      <ProductForm action={action} defaults={defaults} submitLabel="Değişiklikleri kaydet" showInitialStock={false} />

      <section className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="font-bold text-red-700 mb-2">Tehlikeli alan</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Ürünü arşivlersen storefront'tan kalkar, sipariş geçmişi korunur.
        </p>
        <form
          action={deleteProductAction}
          onSubmit={(e) => {
            if (!confirm('Ürünü arşivlemek istediğinden emin misin?')) e.preventDefault();
          }}
        >
          <input type="hidden" name="productId" value={productId} />
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700"
          >
            Ürünü arşivle
          </button>
        </form>
      </section>
    </div>
  );
}
