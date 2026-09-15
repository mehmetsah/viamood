/**
 * "Hoş geldin" pop-up form köprüsü (Defter #974).
 *
 *   POST /api/v1/storefront/welcome-signup  → kaydı yazar, indirim kodu mailini tetikler
 *   OPTIONS                                 → CORS preflight
 *
 * ⚠️ İNDİRİM KODU BU CEVAPTA ASLA DÖNMEZ. Cevap yalnız {ok:true} veya hata
 * bilgisidir. Kod sunucuda kalır ve doğrudan mail gövdesine yazılır — talebin
 * özü bu (kaynağa gömülen kod = kodun sızması).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getAllowedOrigins } from '@/lib/cors';
import { createSignup } from '@/lib/welcome-signup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function corsHeaders(origin: string | null) {
  const allowed = getAllowedOrigins();
  const allow = origin && allowed.includes(origin) ? origin : allowed[0]!;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

/** nginx arkasında gerçek istemci IP'si X-Forwarded-For'un İLK değeridir. */
function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || null;
  return req.headers.get('x-real-ip');
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin'));

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Geçersiz istek' }, { status: 400, headers });
  }

  // Bot tuzağı — görünmez alan doldurulmuşsa sessizce başarı dön (bot fark etmesin).
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true }, { status: 200, headers });
  }

  const utmRaw = (body.utm ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

  const res = await createSignup({
    name: String(body.name ?? ''),
    email: String(body.email ?? ''),
    phone: String(body.phone ?? ''),
    consent: body.consent === true,
    sourceUrl: str(body.sourceUrl) ?? null,
    referrer: str(body.referrer) ?? null,
    utm: {
      source: str(utmRaw.source),
      medium: str(utmRaw.medium),
      campaign: str(utmRaw.campaign),
      term: str(utmRaw.term),
      content: str(utmRaw.content),
    },
    ip: clientIp(req),
    userAgent: req.headers.get('user-agent'),
  });

  if (res.ok) {
    // Bilinçli olarak SADECE ok — kod/kupon bilgisi yok.
    return NextResponse.json({ ok: true }, { status: 200, headers });
  }

  if (res.status === 429) {
    return NextResponse.json(
      { ok: false, error: 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.' },
      { status: 429, headers },
    );
  }

  return NextResponse.json(
    { ok: false, error: 'Lütfen formu kontrol edin', fieldErrors: res.fieldErrors },
    { status: 400, headers },
  );
}
