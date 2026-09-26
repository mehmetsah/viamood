/**
 * Sağlık ucu — DIŞARIYA AÇIK (hesap.viamood.com.tr/api/health → 200).
 *
 * 🔴 GİZLİLİK KURALI: bu uç YALNIZ CANLILIK bilgisi döner.
 * 25 Eyl 2026'da ölçüldü — yanıt `kargolab.meta.userId` ve `memberId` taşıyordu.
 * Bunlar üçüncü kişiye ait iç kimliklerdir ve kimlik doğrulaması olmayan, dışarıya
 * açık bir uçta durmamalıdır. Kaldırıldı.
 *
 * DÖNMESİ YASAK: iç kimlik (userId/memberId), e-posta, müşteri/sipariş verisi,
 * ortam değişkeni, sır/token, yığın izi (stack), veritabanı hata metni.
 * Bir bağımlılık düşerse yalnız `ok:false` + kısa `error` sınıfı yazılır.
 *
 * DEPLOY KAPISI BUNA BAĞLI (scripts/deploy.sh): sözleşme = HTTP 200 + JSON.
 * Bozulursa deploy başarısız sayılır; `tests/deploy-saglik-kapisi.test.ts` bunu çiviler.
 */
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sql } from 'drizzle-orm';
import { healthCheck as kargolabHealth } from '@/lib/kargolab/client';

export const dynamic = 'force-dynamic';

/** Hata metni dışarı sızmasın: yalnız sınıf adı döner (mesaj DB adı/sorgu taşıyabilir). */
function hataSinifi(err: unknown): string {
  return err instanceof Error ? err.constructor.name : 'UnknownError';
}

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // DB canlılığı
  try {
    const t = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.db = { ok: true, latencyMs: Date.now() - t };
  } catch (err) {
    checks.db = { ok: false, error: hataSinifi(err) };
  }

  // KargoLab erişimi — YALNIZ erişilebiliyor mu. Dönen kimlik alanları (userId/memberId)
  // bilerek okunmuyor; bu uçta üçüncü kişinin verisi durmaz.
  if (process.env.KARGOLAB_USER_EMAIL) {
    try {
      const t = Date.now();
      await kargolabHealth();
      checks.kargolab = { ok: true, latencyMs: Date.now() - t };
    } catch (err) {
      checks.kargolab = { ok: false, error: hataSinifi(err) };
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      buildId: process.env.NEXT_BUILD_ID ?? null, // sürüm izi — sır değil, deploy doğrulamasında işe yarar
      uptimeSec: Math.round(process.uptime()), // sürecin ayakta kalma süresi (eskiden istek süresi yazılıyordu)
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 },
  );
}
