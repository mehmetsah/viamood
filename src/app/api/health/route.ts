import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // DB ping
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.db = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.db = { ok: false, error: err instanceof Error ? err.message : 'unknown' };
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
