/**
 * TR Mahalle lookup — KargoLab states-tr proxy + in-memory cache.
 *
 * Query: ?il=İstanbul&ilce=Kadıköy
 * Response: { ok: true, mahalleler: ['GÖZTEPE MAH', ...], cached: bool }
 *
 * Pre-checkout form bunu çağırır — il+ilçe seçildikten sonra mahalle SELECT
 * dropdown'unu doldurmak için.
 *
 * Cache TTL: 24 saat (mahalle listesi nadir değişir).
 * Public endpoint — middleware allowlist'te.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { authFetch } from '@/lib/kargolab/internal';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CacheEntry {
  at: number;
  mahalleler: string[];
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface KargoLabTownResp {
  status: number;
  data?: Array<{ town: string }>;
  message?: string;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=86400',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  const il = (req.nextUrl.searchParams.get('il') ?? '').trim();
  const ilce = (req.nextUrl.searchParams.get('ilce') ?? '').trim();

  if (!il || !ilce) {
    return NextResponse.json(
      { ok: false, error: 'il + ilce zorunlu' },
      { status: 400, headers: corsHeaders() },
    );
  }

  // Title-case'i KargoLab uppercase'e çevir (states-tr KargoLab'da büyük harf)
  const ilUpper = il.toLocaleUpperCase('tr-TR');
  const ilceUpper = ilce.toLocaleUpperCase('tr-TR');
  const key = `${ilUpper}|${ilceUpper}`;

  // 1) Cache hit
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(
      { ok: true, il, ilce, mahalleler: hit.mahalleler, cached: true },
      { headers: corsHeaders() },
    );
  }

  // 2) KargoLab fetch
  let resp: KargoLabTownResp;
  try {
    resp = await authFetch<KargoLabTownResp>('/states-tr', {
      method: 'POST',
      body: JSON.stringify({ state: ilUpper, city: ilceUpper }),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `KargoLab API fail: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 502, headers: corsHeaders() },
    );
  }

  if (resp.status !== 200 || !Array.isArray(resp.data)) {
    return NextResponse.json(
      { ok: false, error: resp.message ?? `KargoLab status ${resp.status}` },
      { status: 502, headers: corsHeaders() },
    );
  }

  // 3) Normalize: "GÖZTEPE MAH" → title-case "Göztepe Mah"
  const mahalleler = resp.data
    .map((t) => titleCaseTr((t.town ?? '').trim()))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'tr'));

  cache.set(key, { at: Date.now(), mahalleler });

  return NextResponse.json(
    { ok: true, il, ilce, mahalleler, cached: false },
    { headers: corsHeaders() },
  );
}

function titleCaseTr(s: string): string {
  if (!s) return s;
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/(^|[\s\-/])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('tr-TR'));
}
