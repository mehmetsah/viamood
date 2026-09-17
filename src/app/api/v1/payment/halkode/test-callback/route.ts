/**
 * GET|POST /api/v1/payment/halkode/test-callback
 * 10 TL deneme akışının dönüş ucu — TEST ve CANLI sayfa için ORTAK.
 * Hangi sayfaya geri dönüleceği adresteki `a` anahtarından belirlenir.
 *
 * Gerçek `callback/route.ts` ile AYNI üç katmanlı doğrulamayı yapar —
 *   1) hash_key app_secret ile çözülüyor mu,
 *   2) imzadaki invoice_id adresteki ile aynı mı,
 *   3) sonuca URL'e değil SUNUCU-SUNUCU /api/checkstatus'a bakılarak karar verilir,
 * ve ek olarak tutar tutarlılığı sorulur.
 *
 * FARKI: sipariş TAMAMLAMAZ, Shopify/RDS'e DOKUNMAZ. Tek çıktısı test sayfasına
 * dönen okunur bir sonuç etiketidir.
 *
 * ⚠️ DOĞRULAMA NEDEN AYNEN KOPYALANDI, "test bu, gevşetelim" DENMEDİ: bu sayfanın
 * amacı akışın canlıda nasıl davranacağını göstermek. Doğrulamayı gevşetseydik
 * Yunus'a çalıştığını gösterdiğimiz şey canlıdaki akış OLMAZDI — yanlış güven
 * üretirdi. Tek istisna sipariş yazma adımıdır; o kasten yok.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import {
  getToken,
  checkStatus,
  decodeHashKey,
  halkodeConfigured,
  halkodeAppSecret,
  HALKODE_STATUS,
} from '@/lib/halkode/client';
import { anahtardanOrtam, sayfaYolu, type HalkodeOrtam } from '@/lib/halkode/test-page';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Kullanıcıyı GELDİĞİ sayfaya geri götürür — canlı dönüşü test sayfasına düşmemeli. */
function don(ortam: HalkodeOrtam, sonuc: string, ek?: Record<string, string>): NextResponse {
  const q = new URLSearchParams({ sonuc, ...(ek ?? {}) });
  const url = `${env.APP_URL.replace(/\/$/, '')}${sayfaYolu(ortam)}?${q.toString()}`;
  return NextResponse.redirect(url, { status: 303 });
}

async function parametreler(req: NextRequest): Promise<Record<string, string>> {
  const p: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) p[k] = v;
  if (req.method === 'POST') {
    try {
      const form = await req.formData();
      for (const [k, v] of form.entries()) p[k] = String(v);
    } catch {
      /* gövde yoksa query yeter */
    }
  }
  return p;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const p = await parametreler(req);

  // Ortam ADRESTEKİ anahtardan okunur; tanınmayan anahtarda test sayfasına
  // "kapalı" ile dönülür (canlı sayfanın varlığını ele vermemek için).
  const ortam = anahtardanOrtam(p.a);
  if (!ortam) return don('test', 'kapali', { detay: 'anahtar' });
  if (!(await halkodeConfigured())) return don(ortam, 'kapali', { detay: 'yapilandirma' });

  const invoiceId = p.invoice_id || '';
  const hashKey = p.hash_key || '';
  if (!invoiceId || !hashKey) return don(ortam, 'iptal', { detay: 'eksik_parametre' });

  const parts = decodeHashKey(hashKey, await halkodeAppSecret());
  if (!parts) return don(ortam, 'hash_cozulmedi', { ref: invoiceId });
  if (parts.invoiceId !== invoiceId) return don(ortam, 'invoice_uyusmuyor', { ref: invoiceId });

  const t = await getToken();
  if (!t.ok) return don(ortam, 'kapali', { detay: 'jeton' });

  const st = await checkStatus(invoiceId, t.token);
  if (!st.ok) {
    // Teşhis log'u — KART ALANI YOK, yalnız işlem ve banka kodu.
    console.log('[halkode-test/callback] basarisiz', {
      ortam,
      invoiceId,
      statusCode: st.statusCode,
      description: st.description,
      urlStatusCode: p.status_code,
      mdStatus: p.md_status,
      bankError: p.original_bank_error_code,
    });
    const etiket = st.statusCode === HALKODE_STATUS.ORDER_OR_PAYMENT_FAILED ? 'declined' : 'iptal';
    return don(ortam, etiket, {
      ref: invoiceId,
      kod: String(st.statusCode),
      // Banka açıklaması kullanıcıya gösterilecek; 120 karakterle sınırlandı.
      aciklama: String(st.description ?? '').slice(0, 120),
    });
  }

  const hashKurus = Math.round(parseFloat(parts.total) * 100);
  const apiKurus = Math.round(
    parseFloat(String(st.data.transaction_amount ?? st.data.product_price ?? '0')) * 100,
  );
  if (Number.isFinite(hashKurus) && Number.isFinite(apiKurus) && apiKurus > 0 && hashKurus !== apiKurus) {
    return don(ortam, 'tutar_uyusmuyor', { ref: invoiceId });
  }

  return don(ortam, 'basarili', {
    ref: invoiceId,
    tutar: (hashKurus / 100).toFixed(2),
    kod: String(st.statusCode),
  });
}

export const GET = handle;
export const POST = handle;
