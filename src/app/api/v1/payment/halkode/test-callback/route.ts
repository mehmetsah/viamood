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
  const invoiceId = p.invoice_id || '';

  // ⚠️ HER DÖNÜŞ, HER KOŞULDA LOGLANIR — ÖNCE, hiçbir erken çıkıştan SONRA değil.
  //
  // NEDEN (17 Eyl 2026'da yaşandı): canlı denemede banka 10 TL'yi çekti ve
  // `status_code=100 Payment Successfully Completed` ile geri döndü. Ama dönüş
  // yanlış orijine düştüğü için önizleme çerezi taşınamadı, `halkodeConfigured()`
  // false oldu ve uç AŞAĞIDAKİ satıra hiç gelmeden çıktı. Sonuç: para çekildi,
  // sistemde TEK SATIR iz kalmadı. İşlem ancak nginx erişim kaydındaki ham query
  // string'ten bulunabildi.
  //
  // Bu satır o sessiz kaybı imkânsız kılar: ne olursa olsun invoice_id ve bankanın
  // status_code'u günlüğe düşer. KART ALANI YOK — yalnız işlem kimliği ve banka
  // kodları (`credit_card_no` gibi alanlar bilerek dışarıda bırakıldı).
  console.info('[halkode/callback-giris] dönüş alındı', {
    ortam: anahtardanOrtam(p.a) ?? 'bilinmiyor',
    invoiceId: invoiceId || '(yok)',
    statusCode: p.status_code ?? '-',
    mdStatus: p.md_status ?? '-',
    orderNo: p.order_no ?? '-',
    bankaHata: p.original_bank_error_code || '-',
    yontem: req.method,
  });

  // Ortam ADRESTEKİ anahtardan okunur; tanınmayan anahtarda test sayfasına
  // "kapalı" ile dönülür (canlı sayfanın varlığını ele vermemek için).
  const ortam = anahtardanOrtam(p.a);
  if (!ortam) {
    console.error('[halkode/callback] REDDEDİLDİ · sebep=anahtar', { invoiceId: invoiceId || '(yok)', statusCode: p.status_code ?? '-' });
    return don('test', 'kapali', { detay: 'anahtar', ...(invoiceId ? { ref: invoiceId } : {}) });
  }
  if (!(await halkodeConfigured())) {
    // ⛔ EN TEHLİKELİ DAL: banka "ödendi" demiş olabilir ama biz doğrulayamıyoruz.
    console.error(
      '[halkode/callback] DOĞRULANAMADI · sebep=yapilandirma · ÖDEME ÇEKİLMİŞ OLABİLİR — ' +
        'bu invoice_id checkstatus ile ELLE sorgulanmalı',
      { invoiceId: invoiceId || '(yok)', statusCode: p.status_code ?? '-', mdStatus: p.md_status ?? '-' },
    );
    return don(ortam, 'kapali', { detay: 'yapilandirma', ...(invoiceId ? { ref: invoiceId } : {}) });
  }

  const hashKey = p.hash_key || '';
  if (!invoiceId || !hashKey) {
    console.error('[halkode/callback] eksik parametre', { invoiceIdVar: !!invoiceId, hashVar: !!hashKey, statusCode: p.status_code ?? '-' });
    return don(ortam, 'iptal', { detay: 'eksik_parametre', ...(invoiceId ? { ref: invoiceId } : {}) });
  }

  const parts = decodeHashKey(hashKey, await halkodeAppSecret());
  if (!parts) {
    console.error('[halkode/callback] imza çözülemedi · ÖDEME ÇEKİLMİŞ OLABİLİR', { invoiceId, statusCode: p.status_code ?? '-' });
    return don(ortam, 'hash_cozulmedi', { ref: invoiceId });
  }
  if (parts.invoiceId !== invoiceId) {
    console.error('[halkode/callback] invoice uyuşmuyor · ÖDEME ÇEKİLMİŞ OLABİLİR', { invoiceId, statusCode: p.status_code ?? '-' });
    return don(ortam, 'invoice_uyusmuyor', { ref: invoiceId });
  }

  const t = await getToken();
  if (!t.ok) {
    console.error('[halkode/callback] jeton alınamadı · ÖDEME ÇEKİLMİŞ OLABİLİR — elle checkstatus gerekir', { invoiceId, hata: t.error });
    return don(ortam, 'kapali', { detay: 'jeton', ref: invoiceId });
  }

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
