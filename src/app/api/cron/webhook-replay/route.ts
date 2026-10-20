/**
 * ÖLÜ MEKTUP REPLAY ÇAĞIRANI (#994753).
 *
 * ⚠ Bu uç olmadan `olu-mektup-replay.ts` ölü koddur — kutuya düşen webhook'lar
 * sonsuza dek orada kalır ("yargıç var, çağıran yok", md.47/§1).
 *
 * TETİKLEME (sunucu crontab, track-refresh ile AYNI kalıp):
 *   GET https://hesap.viamood.com.tr/api/cron/webhook-replay?key=<INTERNAL_API_KEY>&limit=20
 * Öneri sıklık: 10 dk. Geri çekilme mantığı kaydın kendisinde olduğu için sık
 * çağırmak zararsızdır; süresi dolmayan kayıt "atlanan" sayılır.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { webhookOluMektup } from '@/db/schema/webhook-olu-mektup';
import { env } from '@/lib/env';
import { ingestShopifyOrder, type ShopifyOrderPayload } from '@/lib/shopify/order-ingest';
import { ingestShopifyProduct, type ShopifyProductPayload } from '@/lib/shopify/product-ingest';
import { oluMektupReplay, type Isleyici, type OluMektupKaydi, type ReplayDeposu } from '@/lib/shopify/olu-mektup-replay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Konu → gerçek işleyici. Bilinmeyen konu KALICI sayılır (retryable:false). */
const isleyici: Isleyici = async (konu, govde) => {
  if (konu === 'orders/create' || konu === 'orders/updated') {
    const r = await ingestShopifyOrder(govde as ShopifyOrderPayload);
    return r.ok ? { ok: true } : { ok: false, hata: r.error, retryable: r.retryable };
  }
  if (konu === 'products/create' || konu === 'products/update') {
    const r = await ingestShopifyProduct(govde as ShopifyProductPayload);
    return r.ok ? { ok: true } : { ok: false, hata: (r as { error?: string }).error ?? 'urun ingest basarisiz', retryable: false };
  }
  return { ok: false, hata: `replay islemeyen konu: ${konu}`, retryable: false };
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = env.INTERNAL_API_KEY ?? '';
  const key = req.nextUrl.searchParams.get('key') ?? '';
  if (!secret || !safeEqual(key, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') ?? 20), 1), 200);

  const depo: ReplayDeposu = {
    acikKayitlar: async (n) => {
      const rows = await db
        .select()
        .from(webhookOluMektup)
        .where(and(isNull(webhookOluMektup.islendiTs), eq(webhookOluMektup.elleInceleme, false), eq(webhookOluMektup.kalici, false)))
        .orderBy(asc(webhookOluMektup.createdAt))
        .limit(n);
      return rows as unknown as OluMektupKaydi[];
    },
    // SİLME YOK: yalnız damga. Kayıt yerinde kalır, geçmişi okunabilir.
    damgala: async (id, yama) => {
      await db.update(webhookOluMektup).set(yama).where(eq(webhookOluMektup.id, id));
    },
  };

  try {
    const ozet = await oluMektupReplay(depo, isleyici, { limit });
    console.log('[webhook-replay]', JSON.stringify(ozet));
    return NextResponse.json({ ok: true, ...ozet });
  } catch (e) {
    console.error('[webhook-replay] HATA', e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
