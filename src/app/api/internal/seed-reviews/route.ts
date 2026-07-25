/**
 * Seed müşteri yorumu ekleme kapısı (secret-korumalı, idempotent).
 *
 * Göknil'in Instagram-tarzı müşteri yorum kartlarını (görsel + metin) toplu olarak
 * reviews tablosuna ekler — admin panelindeki `addReview` ile AYNI kod yolu:
 * source='seed', status='approved', görsel Shopify Files'a yüklenir.
 *
 * Mükerrer önleme: her kayıt `sourceImage` (kart dosya adı) ile işaretlenir; aynı
 * sourceImage zaten varsa YENİDEN EKLENMEZ (skipped:true döner). Böylece endpoint
 * tekrar tekrar çağrılabilir, kart iki kez eklenmez.
 *
 *  GET  /api/internal/seed-reviews?key=<SHOPIFY_CLIENT_SECRET>
 *       → mevcut seed sourceImage listesi + onaylı sayım (idempotency/doğrulama).
 *  POST /api/internal/seed-reviews?key=<SHOPIFY_CLIENT_SECRET>
 *       body: { sourceImage, isim, metin, urun?, konum?, puan?, imageB64?, mimeType? }
 *       → tek yorum ekler (idempotent). imageB64 verilirse Shopify Files'a yüklenir.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { reviews } from '@/db/schema/reviews';
import { env } from '@/lib/env';
import { uploadImageToShopifyFiles } from '@/lib/shopify/upload-image';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function authed(req: NextRequest): boolean {
  const key = req.nextUrl.searchParams.get('key') ?? '';
  const secret = env.SHOPIFY_CLIENT_SECRET ?? '';
  return Boolean(secret) && safeEqual(key, secret);
}

/** Mevcut seed sourceImage'ları + onaylı sayım (idempotency kontrolü / doğrulama). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const seeded = await db
    .select({ sourceImage: reviews.sourceImage })
    .from(reviews)
    .where(isNotNull(reviews.sourceImage));

  const [agg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.status, 'approved'));

  return NextResponse.json({
    ok: true,
    approvedCount: agg?.n ?? 0,
    seededSourceImages: seeded.map((r) => r.sourceImage).filter(Boolean),
  });
}

/** Tek seed yorumu ekle (idempotent — sourceImage bazlı). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'geçersiz gövde' }, { status: 400 });
  }

  const sourceImage = String(payload.sourceImage ?? '').trim().slice(0, 200);
  const authorName = String(payload.isim ?? '').trim().slice(0, 80) || 'Via Mood Müşterisi';
  const body = String(payload.metin ?? '').trim().slice(0, 1000);
  const rating = Math.max(1, Math.min(5, Number(payload.puan) || 5));
  const location = String(payload.konum ?? '').trim().slice(0, 60) || null;
  const productTitle = String(payload.urun ?? '').trim().slice(0, 160) || null;

  if (!sourceImage) {
    return NextResponse.json({ ok: false, error: 'sourceImage zorunlu' }, { status: 422 });
  }
  if (body.length < 10) {
    return NextResponse.json({ ok: false, error: 'metin en az 10 karakter olmalı' }, { status: 422 });
  }

  // Mükerrer önleme: aynı kart dosyası zaten eklenmişse atla.
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.sourceImage, sourceImage), isNotNull(reviews.sourceImage)))
    .limit(1);
  if (existing) {
    return NextResponse.json({ ok: true, skipped: true, id: existing.id, sourceImage });
  }

  // Görseli (varsa) Shopify Files'a yükle.
  let imageUrl: string | null = null;
  let uploadOk = false;
  let uploadError: string | null = null;
  const b64 = String(payload.imageB64 ?? '').trim();
  if (b64) {
    try {
      const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
      const mime = String(payload.mimeType ?? 'image/jpeg') || 'image/jpeg';
      const fname = `viamood-yorum-${sourceImage.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60)}`;
      const up = await uploadImageToShopifyFiles(bytes, `${fname}.jpg`, mime);
      if (up.ok) {
        imageUrl = up.url;
        uploadOk = true;
      } else {
        uploadError = up.error;
      }
    } catch (e) {
      uploadError = e instanceof Error ? e.message : String(e);
    }
  }

  const [row] = await db
    .insert(reviews)
    .values({
      source: 'seed',
      status: 'approved',
      authorName,
      location,
      rating,
      body,
      productTitle,
      imageUrl,
      verifiedBuyer: true,
      sourceImage,
      moderatedAt: new Date().toISOString(),
      moderatedBy: 'seed-bulk',
    })
    .returning({ id: reviews.id });

  return NextResponse.json({
    ok: true,
    skipped: false,
    id: row?.id,
    sourceImage,
    imageUrl,
    uploadOk,
    uploadError,
  });
}
