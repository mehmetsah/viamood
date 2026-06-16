/**
 * POST /api/admin/product-images/upload  (admin/super_admin)
 * Multipart 'files' → her görseli Shopify Files'a yükle → kalıcı cdn URL listesi döndür.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadImageToShopifyFiles } from '@/lib/shopify/upload-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin')) {
    return NextResponse.json({ ok: false, error: 'Yetkisiz' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'multipart bekleniyor' }, { status: 400 });
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ ok: false, error: 'Dosya yok' }, { status: 400 });

  const urls: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      errors.push(`${file.name}: görsel değil`);
      continue;
    }
    if (file.size > 20 * 1024 * 1024) {
      errors.push(`${file.name}: 20MB üstü`);
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const safeName = (file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 60)) || 'image.png';
    const res = await uploadImageToShopifyFiles(bytes, safeName, file.type);
    if (res.ok) urls.push(res.url);
    else errors.push(`${file.name}: ${res.error}`);
  }

  return NextResponse.json({ ok: urls.length > 0, urls, errors });
}
