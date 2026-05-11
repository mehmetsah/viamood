import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { vendorMemberships, vendors } from '@/db/schema';
import { auth } from '@/lib/auth';
import { ImportClient } from './ImportClient';

export default async function ProductImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/sign-in');

  const [membership] = await db
    .select({ vendorId: vendors.id, status: vendors.status, name: vendors.name })
    .from(vendorMemberships)
    .innerJoin(vendors, eq(vendors.id, vendorMemberships.vendorId))
    .where(eq(vendorMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect('/onboarding');
  if (membership.status !== 'active') {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm text-yellow-900">
          Toplu ürün yüklemesi için tedarikçi durumun <strong>active</strong> olmalı. Şu an{' '}
          <strong>{membership.status}</strong>.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/products" className="text-sm text-neutral-600 hover:underline">
        ← Ürünler
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-2">Toplu Ürün Yükleme</h1>
      <p className="text-neutral-600 text-sm mb-6">
        Excel veya CSV dosyanızı yükleyin — başka bir sistemde (Trendyol, Hepsiburada, IKAS, WooCommerce,
        Logo ERP, vb.) kayıtlı ürünlerinizi tek seferde Via Mood'a aktarın.
      </p>

      <details className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 text-sm text-blue-900">
        <summary className="font-bold cursor-pointer">📘 Hangi sütunları tanırız?</summary>
        <div className="mt-3 space-y-2">
          <p><strong>Tanınan sütun başlıkları</strong> (Türkçe veya İngilizce):</p>
          <ul className="list-disc list-inside ml-2 space-y-0.5">
            <li><code className="bg-white px-1 rounded">title</code> / <code className="bg-white px-1 rounded">başlık</code> / <code className="bg-white px-1 rounded">ürün adı</code> — zorunlu</li>
            <li><code className="bg-white px-1 rounded">price</code> / <code className="bg-white px-1 rounded">fiyat</code> / <code className="bg-white px-1 rounded">satış fiyatı</code> — zorunlu (TL)</li>
            <li><code className="bg-white px-1 rounded">sku</code> / <code className="bg-white px-1 rounded">stok kodu</code></li>
            <li><code className="bg-white px-1 rounded">barcode</code> / <code className="bg-white px-1 rounded">barkod</code> / <code className="bg-white px-1 rounded">ean</code></li>
            <li><code className="bg-white px-1 rounded">description</code> / <code className="bg-white px-1 rounded">açıklama</code></li>
            <li><code className="bg-white px-1 rounded">product_type</code> / <code className="bg-white px-1 rounded">kategori</code></li>
            <li><code className="bg-white px-1 rounded">compare_at_price</code> / <code className="bg-white px-1 rounded">eski fiyat</code></li>
            <li><code className="bg-white px-1 rounded">cost</code> / <code className="bg-white px-1 rounded">maliyet</code></li>
            <li><code className="bg-white px-1 rounded">weight</code> / <code className="bg-white px-1 rounded">ağırlık</code> — kg veya gram (5'ten küçükse kg varsayar)</li>
            <li><code className="bg-white px-1 rounded">stock</code> / <code className="bg-white px-1 rounded">stok</code> / <code className="bg-white px-1 rounded">adet</code></li>
            <li><code className="bg-white px-1 rounded">image</code> / <code className="bg-white px-1 rounded">görsel</code> / <code className="bg-white px-1 rounded">image_url</code></li>
            <li><code className="bg-white px-1 rounded">status</code> / <code className="bg-white px-1 rounded">durum</code> — active / draft / archived</li>
            <li><code className="bg-white px-1 rounded">tags</code> / <code className="bg-white px-1 rounded">etiketler</code> — virgülle ayrılmış</li>
          </ul>
          <p className="mt-2">
            <strong>Format:</strong> CSV (virgül veya noktalı virgül), tab-separated, UTF-8.
            Fiyat: <code className="bg-white px-1 rounded">189,99</code> veya <code className="bg-white px-1 rounded">189.99</code>.
          </p>
          <p>
            <strong>Limit:</strong> 5 MB dosya, tek seferde 2000 satıra kadar.
          </p>
        </div>
      </details>

      <ImportClient />
    </div>
  );
}
