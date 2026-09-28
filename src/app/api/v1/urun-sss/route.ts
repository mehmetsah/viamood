/**
 * GET /api/v1/urun-sss?handle=<urun-handle> — ürünün SSS listesi (#991833).
 *
 * Shopify TEMASI bu uçtan çeker: tema dosyası bizde değil, veri bizde. Yanıt
 * herkese açık ama yalnız `acik=true` kayıtları döner ve okuma-only.
 *
 * CORS: tema `viamood.com.tr` alanından çağıracak, bu uç `hesap.viamood.com.tr`
 * altında — izin verilen kaynak `lib/cors` üzerinden tek kaynaktan gelir.
 */
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { urunSss } from '@/db/schema/urun-sss';
import { handleTemizle, sssSirala } from '@/lib/urun-sss';
import { resolveCorsOrigin } from '@/lib/cors';

export const dynamic = 'force-dynamic';

/** Tek kaynak `lib/cors` — izin listesi burada ÇOĞALTILMAZ. */
function basliklarUret(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveCorsOrigin(origin),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=60',
  };
}

export async function GET(req: Request) {
  const basliklar = basliklarUret(req.headers.get('origin'));
  const handle = handleTemizle(new URL(req.url).searchParams.get('handle'));
  if (!handle) {
    return NextResponse.json({ ok: false, error: 'handle gerekli' }, { status: 400, headers: basliklar });
  }
  try {
    const satirlar = await db
      .select({ soru: urunSss.soru, cevap: urunSss.cevap, sira: urunSss.sira })
      .from(urunSss)
      .where(and(eq(urunSss.urunHandle, handle), eq(urunSss.acik, true)));
    return NextResponse.json({ ok: true, handle, sss: sssSirala(satirlar) }, { headers: basliklar });
  } catch {
    // Göç (0028) koşmadıysa sekme BOŞ görünür, ürün sayfası çökmez.
    return NextResponse.json({ ok: true, handle, sss: [] }, { headers: basliklar });
  }
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: basliklarUret(req.headers.get('origin')) });
}
