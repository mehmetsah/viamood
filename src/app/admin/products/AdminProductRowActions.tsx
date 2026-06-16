'use client';

import Link from 'next/link';
import { adminDeleteProductAction, adminSetStatusAction } from '@/lib/actions/admin-product';

export function AdminProductRowActions({ productId, status }: { productId: string; status: string }) {
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <Link
        href={`/admin/products/${productId}`}
        className="px-2.5 py-1 text-xs font-semibold rounded border border-neutral-300 hover:bg-neutral-100"
      >
        Düzenle
      </Link>
      {status !== 'active' ? (
        <form action={adminSetStatusAction}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="status" value="active" />
          <button
            type="submit"
            className="px-2.5 py-1 text-xs font-semibold rounded bg-green-600 text-white hover:bg-green-700"
          >
            Yayınla
          </button>
        </form>
      ) : (
        <form action={adminSetStatusAction}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="status" value="draft" />
          <button
            type="submit"
            className="px-2.5 py-1 text-xs font-semibold rounded bg-yellow-500 text-white hover:bg-yellow-600"
          >
            Taslak
          </button>
        </form>
      )}
      <form
        action={adminDeleteProductAction}
        onSubmit={(e) => {
          if (!confirm('Ürünü silmek istediğine emin misin?')) e.preventDefault();
        }}
      >
        <input type="hidden" name="productId" value={productId} />
        <button
          type="submit"
          className="px-2.5 py-1 text-xs font-semibold rounded border border-red-300 text-red-600 hover:bg-red-50"
        >
          Sil
        </button>
      </form>
    </div>
  );
}
