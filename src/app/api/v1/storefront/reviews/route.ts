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
import { eskiKopruAnahtari, imzaGecerliMi } from '@/lib/storefront/imza';
import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { env } from '@/lib/env';
import { reviews } from '@/db/schema/reviews';
import { orders, orderLineItems } from '@/db/schema/orders';
import { products } from '@/db/schema/products';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// İmzalama anahtarı KODA GÖMÜLEMEZ. Eski sabit anahtar public repoda
// paylaşıldığı için güvenilir değildir ve mutlaka yenisiyle değiştirilmelidir.
// Anahtar tanımsızsa yorum kabul edilir; verifiedBuyer=false kalır.
const BRIDGE_KEY = (process.env.STOREFRONT_BRIDGE_KEY ?? '').trim();

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': env.STOREFRONT_URL.replace(/\/$/, ''),
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

  // ÖZET, listeyle AYNI filtreyi kullanır (`where`).
  // Eskiden burada sabit `eq(status,'approved')` vardı: ?handle= ile liste doğru
  // filtreleniyor ama count/average SİTE GENELİ dönüyordu → ürün sayfasında her üründe
  // aynı "31 Değerlendirme / 5.0" görünürdü. Bu değer yıldız bileşenine ve JSON-LD
  // aggregateRating'e beslendiği için Google'a da yanlış (fiilen uydurma) rating gider.
  const [agg] = await db
    .select({ n: sql<number>`count(*)::int`, avg: sql<number>`coalesce(avg(${reviews.rating}),0)` })
    .from(reviews)
    .where(where);

  const count = agg?.n ?? 0;

  return NextResponse.json(
    {
      ok: true,
      count,
      // Yorum yoksa ortalama ANLAMSIZ → null. Tema "0.0 yıldız" basmasın diye.
      average: count > 0 ? Number(agg?.avg ?? 0).toFixed(1) : null,
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

  // İmza sadece mağaza oturum e-postasını doğrular, SATIN ALIMI DEĞİL.
  // "Doğrulanmış alıcı" etiketi için bu ürünün TESLİM EDİLMİŞ satırı gerekir.
  // Eski repoya yazılmış sabit anahtarın hiçbir güven değeri yoktur.
  let verifiedBuyer = false;
  if (email && productHandle && imzaGecerliMi(email, sig, BRIDGE_KEY, eskiKopruAnahtari())) {
    try {
      const [satir] = await db.select({ id: orderLineItems.id })
        .from(orderLineItems)
        .innerJoin(orders, eq(orderLineItems.orderId, orders.id))
        .innerJoin(products, eq(orderLineItems.productId, products.id))
        .where(and(
          sql`lower(${orders.customerEmail}) = ${email}`,
          eq(products.shopifyHandle, productHandle),
          eq(orderLineItems.status, 'delivered'),
          eq(orders.fulfillmentStatus, 'fulfilled'),
        ))
        .limit(1);
      verifiedBuyer = Boolean(satir);
    } catch {
      // DB/ürün eşleşmesi kanıtlanamadıysa etiketi VERME (yorum yine pending).
      verifiedBuyer = false;
    }
  }

  // Tek IP'den kısa sürede yapılan toplu yorumları sınırlamayı DB üzerinde
  // tut: process yeniden başlasa da sınır silinmesin. (Paylaşılan IP: 20/saat.)
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ipHash = crypto
    .createHash('sha256')
    .update(ip + (BRIDGE_KEY || env.AUTH_SECRET))
    .digest('hex')
    .slice(0, 32);
  const [sonSaat] = await db.select({ n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.ipHash, ipHash), gt(reviews.createdAt, new Date(Date.now() - 3600_000))));
  if ((sonSaat?.n ?? 0) >= 20) {
    return NextResponse.json({ ok: false, error: 'Çok fazla yorum denemesi. Daha sonra tekrar deneyin.' },
      { status: 429, headers: corsHeaders() });
  }

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
