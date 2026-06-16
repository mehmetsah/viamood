'use client';

import { useState, useTransition } from 'react';
import { ProductForm } from '@/components/products/ProductForm';
import {
  adminDeleteProductAction,
  adminPushProductAction,
  adminSetStatusAction,
  adminUpdateProductAction,
} from '@/lib/actions/admin-product';
import type { ActionResult } from '@/lib/actions/auth';

interface Props {
  productId: string;
  defaults: Parameters<typeof ProductForm>[0]['defaults'];
  status: 'draft' | 'active' | 'archived';
  shopifyProductId: string;
  shopifyHandle: string;
}

const STATUS_LABEL: Record<string, string> = { active: 'Yayında', draft: 'Taslak', archived: 'Arşiv' };
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-neutral-200 text-neutral-700',
};

export function AdminProductEditClient({ productId, defaults, status, shopifyProductId, shopifyHandle }: Props) {
  const action = async (_prev: ActionResult | null, formData: FormData) =>
    adminUpdateProductAction(productId, formData);

  const [pushState, setPushState] = useState<
    { kind: 'idle' } | { kind: 'success'; message: string } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const [isPushing, startPush] = useTransition();

  const isPublished = !shopifyProductId.startsWith('local_');

  const handlePush = () => {
    setPushState({ kind: 'idle' });
    startPush(async () => {
      const res = await adminPushProductAction(productId);
      setPushState(
        res.success
          ? { kind: 'success', message: 'Shopify’a gönderildi. Sayfayı yenileyince güncel durum görünür.' }
          : { kind: 'error', message: res.error ?? 'Bilinmeyen hata' },
      );
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Durum & Yayın ── */}
      <section className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold">Durum:</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_BADGE[status] ?? ''}`}>
              {STATUS_LABEL[status] ?? status}
            </span>
            {isPublished ? (
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Shopify: Yayında</span>
            ) : (
              <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full">Shopify: Bekliyor</span>
            )}
            <span className="text-xs text-neutral-400 font-mono">{shopifyHandle}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {status !== 'active' && (
              <form action={adminSetStatusAction}>
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="status" value="active" />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700"
                >
                  Yayına Al
                </button>
              </form>
            )}
            {status !== 'draft' && (
              <form action={adminSetStatusAction}>
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="status" value="draft" />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg font-semibold text-sm hover:bg-yellow-600"
                >
                  Taslağa Al
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={handlePush}
              disabled={isPushing}
              className="px-3 py-1.5 bg-black text-white rounded-lg font-semibold text-sm hover:bg-neutral-800 disabled:opacity-50"
            >
              {isPushing ? 'Gönderiliyor…' : isPublished ? 'Shopify’a Güncelle' : '🚀 Shopify’a Gönder'}
            </button>
          </div>
        </div>
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
        <p className="text-xs text-neutral-500 mt-3">
          “Yayına Al” ürünü aktif yapıp Shopify’a gönderir (canlı). “Taslağa Al” storefronttan gizler. Formdaki
          değişiklikleri kaydettikten sonra “Shopify’a Güncelle” ile canlıya yansıt.
        </p>
      </section>

      {/* ── Ürün formu ── */}
      <ProductForm
        action={action}
        defaults={defaults}
        submitLabel="Değişiklikleri kaydet"
        showInitialStock={false}
      />

      {/* ── Tehlikeli alan ── */}
      <section className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="font-bold text-red-700 mb-2">Tehlikeli alan</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Ürünü silersen listeden kalkar ve (yayındaysa) storefronttan kaldırılır. Sipariş geçmişi korunur.
        </p>
        <form
          action={adminDeleteProductAction}
          onSubmit={(e) => {
            if (!confirm('Ürünü silmek istediğine emin misin?')) e.preventDefault();
          }}
        >
          <input type="hidden" name="productId" value={productId} />
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700"
          >
            Ürünü sil
          </button>
        </form>
      </section>
    </div>
  );
}
