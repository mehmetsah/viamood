import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sql } from 'drizzle-orm';
import { healthCheck as kargolabHealth } from '@/lib/kargolab/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string; meta?: unknown }> = {};

  // DB ping
  try {
    const t = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.db = { ok: true, latencyMs: Date.now() - t };
  } catch (err) {
    checks.db = { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }

  // KargoLab auth check (only if credentials present)
  if (process.env.KARGOLAB_USER_EMAIL) {
    try {
      const t = Date.now();
      const k = await kargolabHealth();
      checks.kargolab = {
        ok: true,
        latencyMs: Date.now() - t,
        meta: { userId: k.userId, memberId: k.memberId },
      };
    } catch (err) {
      checks.kargolab = { ok: false, error: err instanceof Error ? err.message : 'unknown' };
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - startedAt) / 1000),
    },
    { status: allOk ? 200 : 503 },
  );
}
