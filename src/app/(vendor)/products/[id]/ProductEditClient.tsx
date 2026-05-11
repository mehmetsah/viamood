'use client';

import { useState, useTransition } from 'react';
import { ProductForm } from '@/components/products/ProductForm';
import {
  deleteProductAction,
  pushProductToShopifyAction,
  updateProductAction,
} from '@/lib/actions/product';
import type { ActionResult } from '@/lib/actions/auth';

interface Props {
  productId: string;
  defaults: Parameters<typeof ProductForm>[0]['defaults'];
  shopifyProductId: string;
  shopifyHandle: string;
}

function shopifyAdminProductLink(shopifyProductId: string, shopDomain: string): string | null {
  const m = shopifyProductId.match(/^gid:\/\/shopify\/Product\/(\d+)$/);
  if (!m) return null;
  return `https://${shopDomain}/admin/products/${m[1]}`;
}

export function ProductEditClient({ productId, defaults, shopifyProductId, shopifyHandle }: Props) {
  const action = async (_prev: ActionResult | null, formData: FormData) =>
    updateProductAction(productId, formData);

  const [pushState, setPushState] = useState<
    | { kind: 'idle' }
    | { kind: 'success'; message: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const [isPushing, startPush] = useTransition();

  const isPublished = !shopifyProductId.startsWith('local_');
  const adminLink = isPublished
    ? shopifyAdminProductLink(shopifyProductId, 'admin.shopify.com/store/via-mood')
    : null;

  const handlePush = () => {
    setPushState({ kind: 'idle' });
    startPush(async () => {
      const res = await pushProductToShopifyAction(productId);
      if (res.success) {
        setPushState({
          kind: 'success',
          message: 'Shopify\'a başarıyla yayınlandı. Sayfayı yenileyince güncel ID görünür.',
        });
      } else {
        setPushState({
          kind: 'error',
          message: res.error ?? 'Bilinmeyen hata',
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <ProductForm action={action} defaults={defaults} submitLabel="Değişiklikleri kaydet" showInitialStock={false} />

      <section className="bg-white rounded-xl border p-6">
        <h2 className="font-bold mb-2 flex items-center gap-2">
          🛍️ Shopify
          {isPublished ? (
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Yayında</span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full">Henüz yayında değil</span>
          )}
        </h2>
        <p className="text-sm text-neutral-600 mb-4">
          {isPublished
            ? 'Bu ürün Shopify mağazasında yayında. Değişiklikleri tekrar gönderebilirsin.'
            : 'Ürün şu anda sadece vendor platformunda. Yayınla butonu ile Shopify\'a aktar.'}
        </p>

        {adminLink && (
          <p className="text-xs text-neutral-500 mb-3">
            Handle: <span className="font-mono">{shopifyHandle}</span>
            {' · '}
            <a href={adminLink} target="_blank" rel="noreferrer" className="underline text-blue-600">
              Shopify Admin'de aç ↗
            </a>
          </p>
        )}

        <button
          type="button"
          onClick={handlePush}
          disabled={isPushing}
          className="px-4 py-2 bg-black text-white rounded-lg font-semibold text-sm hover:bg-neutral-800 disabled:opacity-50"
        >
          {isPushing
            ? 'Gönderiliyor...'
            : isPublished
              ? 'Shopify\'a güncellemeyi gönder'
              : '🚀 Shopify\'a yayınla'}
        </button>

        {pushState.kind === 'success' && (
          <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            ✓ {pushState.message}
          </p>
        )}
        {pushState.kind === 'error' && (
          <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 break-words">
            ⚠ {pushState.message}
          </p>
        )}
      </section>

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
