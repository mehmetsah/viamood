import { ne } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { vendors } from '@/db/schema';
import { AdminProductNewClient } from './AdminProductNewClient';

interface PageProps {
  searchParams: Promise<{ vendor?: string }>;
}

export default async function AdminNewProductPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const vendorList = await db
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .where(ne(vendors.status, 'archived'))
    .orderBy(vendors.name);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/admin/products" className="text-sm text-neutral-600 hover:underline">
        ← Tüm Ürünler
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-1">Yeni Ürün</h1>
      <p className="text-neutral-600 text-sm mb-8">
        Tedarikçi seç ve ürünü gir. Oluşturduktan sonra düzenleme sayfasında “Yayına Al” ile Shopify’a gönderebilirsin.
      </p>
      <AdminProductNewClient vendors={vendorList} defaultVendorId={sp.vendor} />
    </div>
  );
}
