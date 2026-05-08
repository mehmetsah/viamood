'use client';

import Link from 'next/link';
import { ProductForm } from '@/components/products/ProductForm';
import { createProductAction } from '@/lib/actions/product';
import type { ActionResult } from '@/lib/actions/auth';

export default function NewProductPage() {
  const action = async (_prev: ActionResult | null, formData: FormData) =>
    createProductAction(formData);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/products" className="text-sm text-neutral-600 hover:underline">
        ← Ürünler
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-8">Yeni Ürün</h1>
      <ProductForm action={action} submitLabel="Ürünü oluştur" showInitialStock />
    </div>
  );
}
