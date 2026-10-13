/**
 * OTOMATİK E-POSTA AKIŞI — ZAMANLAYICI UCU (#994057).
 *
 * md.47'nin kuralı: "yargıç var, çağıran yok" bu deponun en sık arızası. Karar
 * katmanı 3 Eki'de, koşucu 10 Eki'de yazıldı ama ikisini ÇAĞIRAN hiçbir şey
 * yoktu — sistem kurulu görünüyor, tek mail göndermiyordu. Çağıran burada.
 *
 * TETİKLEME (sunucu crontab / Vercel cron / external scheduler):
 *   GET https://<platform>/api/cron/eposta-akis?key=<INTERNAL_API_KEY>&limit=100
 * Önerilen sıklık: 15 dk. Spec'in en küçük adımı 1 saat olduğundan 15 dk'lık
 * yoklama en kötü hâlde 15 dk gecikme demektir; daha sık koşmak kazanç getirmez.
 *
 * ⛔ EMNİYET ANAHTARI: `EPOSTA_AKIS_AKTIF=1` verilmedikçe hiçbir mail GİTMEZ
 * (uç `{aktif:false}` döner). Canlıya alma kararı tek çevre değişkeniyle açılıp
 * kapanır; kod geri alınmadan durdurulabilir — "geri dönüşü kolay" şartı (md. push).
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/db/client';
import { env } from '@/lib/env';
import { gonderimTuru } from '@/lib/eposta-akis-gonderim';
import { terkTara } from '@/lib/eposta-akis-tetik';

export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Akış açık mı? Varsayılan KAPALI — yanlışlıkla canlı mail gitmesin. */
export function akisAktifMi(deger = process.env.EPOSTA_AKIS_AKTIF): boolean {
  return (deger ?? '').trim() === '1';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = env.INTERNAL_API_KEY ?? '';
  const key = req.nextUrl.searchParams.get('key') ?? '';
  if (!secret || !safeEqual(key, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!akisAktifMi()) {
    return NextResponse.json({ ok: true, aktif: false, not: 'EPOSTA_AKIS_AKTIF=1 verilmedi — mail gönderilmedi' });
  }

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') ?? 100), 1), 200);
  // KURU KOŞU: &prova=1 ile tarama yapılır, mail GÖNDERİLMEZ (kanıt toplamak için).
  const prova = req.nextUrl.searchParams.get('prova') === '1';
  const simdi = new Date();

  try {
    const terk = await terkTara(db as any, { simdi, limit });
    const gonderim = await gonderimTuru(db as any, {
      simdi,
      limit,
      ...(prova ? { gonder: async () => ({ ok: false, error: 'PROVA: mail gönderilmedi' }) } : {}),
    });
    return NextResponse.json({ ok: true, aktif: true, prova, terk, gonderim });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
