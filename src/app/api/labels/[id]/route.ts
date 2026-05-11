import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { fulfillments, vendorMemberships } from '@/db/schema';
import { auth } from '@/lib/auth';

/**
 * Kargo etiket PDF'ini KargoLab'tan döndürür.
 * Etiket FetchLabel sonucunda metadata.kargolabLabelPdf alanına yazıldığı için
 * burası DB'den base64 → buffer dönüşümü yapıp browser'a application/pdf serve eder.
 *
 * URL şekli: /api/labels/{fulfillmentId}.pdf
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: Params) {
  const { id: rawId } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Auth gerekli' }, { status: 401 });
  }

  const id = rawId.replace(/\.pdf$/i, '');

  const [row] = await db
    .select({
      id: fulfillments.id,
      vendorId: fulfillments.vendorId,
      metadata: fulfillments.metadata,
    })
    .from(fulfillments)
    .where(eq(fulfillments.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: 'bulunamadı' }, { status: 404 });

  // Yetki: vendor üyesi VEYA admin
  const role = (session.user as { role?: string }).role;
  const isAdmin = role === 'admin' || role === 'super_admin';
  if (!isAdmin) {
    const [membership] = await db
      .select({ vendorId: vendorMemberships.vendorId })
      .from(vendorMemberships)
      .where(eq(vendorMemberships.userId, session.user.id))
      .limit(1);
    if (!membership || membership.vendorId !== row.vendorId) {
      return NextResponse.json({ error: 'Yetki yok' }, { status: 403 });
    }
  }

  const meta = row.metadata as Record<string, unknown> | null;
  const pdfB64 = meta?.kargolabLabelPdf as string | undefined;
  if (!pdfB64) return NextResponse.json({ error: 'Etiket PDF yok' }, { status: 404 });

  const buf = Buffer.from(pdfB64, 'base64');
  const fileName = (meta?.kargolabLabelFileName as string | undefined) ?? `label-${id}.pdf`;
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
