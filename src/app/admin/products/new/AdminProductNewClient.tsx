'use client';

import { ProductForm } from '@/components/products/ProductForm';
import { adminCreateProductAction } from '@/lib/actions/admin-product';
import type { ActionResult } from '@/lib/actions/auth';

interface Props {
  vendors: { id: string; name: string }[];
  defaultVendorId?: string;
}

export function AdminProductNewClient({ vendors, defaultVendorId }: Props) {
  const action = async (_prev: ActionResult | null, formData: FormData) =>
    adminCreateProductAction(formData);

  return (
    <ProductForm
      action={action}
      submitLabel="Ürünü oluştur"
      showInitialStock
      vendors={vendors}
      defaultVendorId={defaultVendorId}
    />
  );
}
