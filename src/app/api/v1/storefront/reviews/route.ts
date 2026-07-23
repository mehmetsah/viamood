/**
 * Storefront müşteri yorumları köprüsü. CANLI.
 *
 *  GET  /api/v1/storefront/reviews         → onaylı yorumlar (anasayfa/ürün için)
 *  POST /api/v1/storefront/reviews         → yeni yorum (status='pending')
 *  OPTIONS                                 → CORS preflight
 *
 * Auth (POST): storefront'ta müşteri oturumu varsa tema, e-postayı
 *   {{ customer.email | hmac_sha256: BRIDGE_KEY }} ile imzalar (addresses köprüsüyle
 *   AYNI anahtar). İmza geçerliyse verifiedBuyer, orders eşleşmesiyle doğrulanır.
 *   İmzasız gönderim de kabul edilir ama verifiedBuyer=false + moderasyon şart.
 *
 * Spam savunması: alan-bazlı uzunluk sınırı + honeypot + IP hash rate-limit (TODO).
 */
import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { reviews } from '@/db/schema/reviews';
// import { orders } from '@/db/schema'; // verified-buyer eşlemesi aktive edilince

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// via-checkout.liquid / addresses köprüsüyle paylaşılan anahtar.
const BRIDGE_KEY = '15e66ee567ae0186394a79588f077a84ba483c8f341508f237bd5f7500524734';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://viamood.com.tr',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/** Onaylı yorumları döndürür (public — e-posta/IP gibi PII DÖNMEZ). */
export async function GET(req: NextRequest) {
  const handle = (req.nextUrl.searchParams.get('handle') ?? '').trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 24) || 24, 60);

  const where = handle
    ? and(eq(reviews.status, 'approved'), eq(reviews.productHandle, handle))
    : eq(reviews.status, 'approved');

  const rows = await db
    .select({
      id: reviews.id,
      authorName: reviews.authorName,
      location: reviews.location,
      rating: reviews.rating,
      body: reviews.body,
      productTitle: reviews.productTitle,
      imageUrl: reviews.imageUrl,
      verifiedBuyer: reviews.verifiedBuyer,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(where)
    .orderBy(desc(reviews.createdAt))
    .limit(limit);

  const [agg] = await db
    .select({ n: sql<number>`count(*)::int`, avg: sql<number>`coalesce(avg(${reviews.rating}),0)` })
    .from(reviews)
    .where(eq(reviews.status, 'approved'));

  return NextResponse.json(
    {
      ok: true,
      count: agg?.n ?? 0,
      average: Number(agg?.avg ?? 0).toFixed(1),
      reviews: rows,
    },
    { headers: corsHeaders() },
  );
}

/** Yeni yorum — daima status='pending' (admin onayına düşer). */
export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'geçersiz gövde' }, { status: 400, headers: corsHeaders() });
  }

  // Honeypot: gizli alan doluysa bot → sessizce başarı taklidi.
  if (typeof payload.website === 'string' && payload.website.trim() !== '') {
    return NextResponse.json({ ok: true, queued: true }, { headers: corsHeaders() });
  }

  const authorName = String(payload.isim ?? '').trim().slice(0, 80);
  const body = String(payload.metin ?? '').trim().slice(0, 1000);
  const rating = Math.max(1, Math.min(5, Number(payload.puan) || 5));
  const location = String(payload.konum ?? '').trim().slice(0, 60) || null;
  const productHandle = String(payload.urun_handle ?? '').trim().slice(0, 120) || null;
  const productTitle = String(payload.urun ?? '').trim().slice(0, 160) || null;
  const email = String(payload.email ?? '').trim().toLowerCase() || null;
  const sig = String(payload.sig ?? '').trim().toLowerCase();

  if (authorName.length < 2 || body.length < 10) {
    return NextResponse.json(
      { ok: false, error: 'İsim ve en az 10 karakterlik yorum gerekli.' },
      { status: 422, headers: corsHeaders() },
    );
  }

  // Doğrulanmış alıcı: imza geçerli mi? (orders eşlemesi aktivasyonda eklenecek)
  let verifiedBuyer = false;
  if (email && sig) {
    const expected = crypto.createHmac('sha256', BRIDGE_KEY).update(email).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig.padEnd(expected.length).slice(0, expected.length)))) {
      verifiedBuyer = true; // TODO: orders tablosunda bu e-posta ile teslim edilmiş sipariş ara.
    }
  }

  const ipHash = crypto
    .createHash('sha256')
    .update((req.headers.get('x-forwarded-for') ?? 'unknown') + BRIDGE_KEY)
    .digest('hex')
    .slice(0, 32);

  await db.insert(reviews).values({
    source: 'customer',
    status: 'pending',
    authorName,
    location,
    rating,
    body,
    productTitle,
    productHandle,
    customerEmail: email,
    verifiedBuyer,
    ipHash,
  });

  return NextResponse.json(
    { ok: true, queued: true, message: 'Yorumun alındı, onaydan sonra yayınlanacak. Teşekkürler!' },
    { headers: corsHeaders() },
  );
}
