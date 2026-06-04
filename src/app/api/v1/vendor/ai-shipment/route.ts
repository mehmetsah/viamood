/**
 * AI Shipment Extraction endpoint
 *
 * POST /api/v1/vendor/ai-shipment
 * body: { text: string, source?: 'whatsapp'|'instagram'|'other' }
 *
 * Auth: vendor session or vendor API token.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { extractShipment } from '@/lib/ai/shipment-extractor';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  text: z.string().min(5).max(8000),
  source: z.enum(['whatsapp', 'instagram', 'other']).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  if (
    role !== 'vendor' &&
    role !== 'vendor_admin' &&
    role !== 'admin' &&
    role !== 'super_admin'
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Form hatası' },
      { status: 400 },
    );
  }

  const result = await extractShipment(parsed.data.text, { sourceHint: parsed.data.source });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    data: result.data,
    model_used: result.model_used,
  });
}
