/**
 * POST /api/v1/payment/halkode/test-initialize
 *
 * 10 TL SABİT deneme ödemesi başlatır — TEST ve CANLI sayfanın ORTAK ucu.
 * `initialize/route.ts`ten AYRI ve KASITLI olarak sade: Shopify draft'ı YOK,
 * RDS siparişi YOK, indirim/kargo/fatura mantığı YOK. Tek işi Halköde'ye 3D
 * isteği atıp bankanın HTML formunu döndürmek.
 *
 * ⚠️ NEDEN ayrı uç: gerçek initialize her denemede sipariş kaydı üretir. Yunus
 * linki beş kez denerse beş "ödeme bekleniyor" siparişi açılır ve operasyon
 * ekibi bunları gerçek sanır. Test akışının veri bırakmaması, kod tekrarından
 * daha değerli.
 *
 * ⚠️ TUTAR İSTEMCİDEN ALINMAZ. İstemci 1 TL yazıp 1 TL'lik imza ürettiremesin
 * diye tutar sunucudaki sabitten okunur; istemci yalnız TAKSİT SAYISI seçebilir.
 *
 * GÜVENLİK: uç, Halköde önizleme çerezi olmadan çalışmaz (halkodeEnabled()
 * çerezsiz false döner). Hangi ortama gidileceğini ÇEREZ söyler, hangi sayfada
 * olunduğunu ANAHTAR — ikisi eşleşmezse istek 403 ile reddedilir. Yani "TEST"
 * yazan bir sayfadan canlı POS'a para gönderilemez.
 *
 * ⚠️ CANLI ortamda bu uç GERÇEK PARA çeker (10,00 TL). Canlı yol yalnız
 * paneldeki `halkode_canli_deneme` anahtarı açıkken ve ortamdaki
 * HALKODE_CANLI_ANAHTAR tanımlıyken vardır.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  getToken,
  paySmart3D,
  buildInvoiceId,
  halkodeConfigured,
  halkodeEnabled,
} from '@/lib/halkode/client';
import { TEST_TUTAR_TL, anahtardanOrtam } from '@/lib/halkode/test-page';
import { halkodeOnizlemeOrtami } from '@/lib/halkode/preview';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Govde {
  anahtar?: string;
  installments_number?: number;
  cc_holder_name?: string;
  cc_no?: string;
  expiry_month?: string;
  expiry_year?: string;
  cvv?: string;
}

export async function POST(req: NextRequest) {
  const h = { 'Content-Type': 'application/json' };

  if (!(await halkodeEnabled()) || !(await halkodeConfigured())) {
    return NextResponse.json(
      { ok: false, error: 'Halköde kapalı — sayfayı test linkinden tekrar aç.' },
      { status: 503, headers: h },
    );
  }

  let b: Govde;
  try {
    b = (await req.json()) as Govde;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers: h });
  }

  const ortam = anahtardanOrtam(b.anahtar);
  if (!ortam) {
    return NextResponse.json({ ok: false, error: 'gecersiz_anahtar' }, { status: 403, headers: h });
  }

  // ⚠️ ANAHTAR ile ÇEREZ AYNI ORTAMI göstermeli. Ortamı çerez belirliyor
  // (client.ts cfg()), ekranı ise anahtar. İkisi ayrışırsa kullanıcı "TEST"
  // yazan sayfada canlı POS'tan para ödeyebilirdi: canlı sayfayı açıp çerezi
  // aldıktan sonra test anahtarıyla istek atmak yeterdi. Bu kontrol o yolu kapatır.
  const cerezOrtam = await halkodeOnizlemeOrtami();
  if (cerezOrtam !== ortam) {
    return NextResponse.json(
      { ok: false, error: 'Oturum ortamı sayfa ile uyuşmuyor — sayfayı linkten tekrar aç.' },
      { status: 403, headers: h },
    );
  }

  // Kart alanları: BİZE UĞRAR, HİÇBİR YERE YAZILMAZ. Log'a da girmez —
  // aşağıdaki hiçbir console çağrısı kart alanı içermez (bilerek).
  const ccNo = String(b.cc_no ?? '').replace(/\s/g, '');
  const cvv = String(b.cvv ?? '').trim();
  const ay = String(b.expiry_month ?? '').padStart(2, '0');
  const yil = String(b.expiry_year ?? '').trim();
  const sahip = String(b.cc_holder_name ?? '').trim();

  if (ccNo.length < 15 || ccNo.length > 19) {
    return NextResponse.json({ ok: false, error: 'Kart numarası eksik ya da hatalı.' }, { status: 422, headers: h });
  }
  if (cvv.length < 3 || cvv.length > 4) {
    return NextResponse.json({ ok: false, error: 'CVV 3 haneli olmalı.' }, { status: 422, headers: h });
  }
  if (!/^\d{2}$/.test(ay) || !/^\d{4}$/.test(yil)) {
    return NextResponse.json({ ok: false, error: 'Son kullanma tarihi AA / YYYY biçiminde olmalı.' }, { status: 422, headers: h });
  }
  if (sahip.length < 3) {
    return NextResponse.json({ ok: false, error: 'Kart üzerindeki isim gerekli.' }, { status: 422, headers: h });
  }

  const taksit = Number(b.installments_number ?? 1);
  if (!Number.isInteger(taksit) || taksit < 1 || taksit > 12) {
    return NextResponse.json({ ok: false, error: 'Taksit seçimi geçersiz.' }, { status: 422, headers: h });
  }

  const t = await getToken();
  if (!t.ok) {
    return NextResponse.json({ ok: false, error: `Halköde jetonu alınamadı: ${t.error}` }, { status: 502, headers: h });
  }

  // invoice_id'ye draft numarası GÖMÜLMEZ (null) — callback bu akışta sipariş aramaz.
  const invoiceId = buildInvoiceId(null, `t${Date.now().toString(36)}`);
  const donus = `${env.APP_URL.replace(/\/$/, '')}/api/v1/payment/halkode/test-callback?a=${encodeURIComponent(b.anahtar ?? '')}`;

  const pay = await paySmart3D(
    {
      ccHolderName: sahip,
      ccNo,
      expiryMonth: ay,
      expiryYear: yil,
      cvv,
      total: TEST_TUTAR_TL,
      installmentsNumber: taksit,
      invoiceId,
      invoiceDescription: `Via Mood Halköde ${ortam === 'canli' ? 'canlı deneme' : 'test'} — ${TEST_TUTAR_TL.toFixed(2)} TL`,
      name: sahip.split(/\s+/)[0] || 'Test',
      surname: sahip.split(/\s+/).slice(1).join(' ') || 'Kullanici',
      // items toplamı total ile EŞİT olmalı — yoksa Halköde status 13 döner.
      items: [{ name: 'Halkode test islemi', price: TEST_TUTAR_TL, quantity: 1 }],
      returnUrl: donus,
      cancelUrl: donus,
    },
    t.token,
  );

  if (!pay.ok) {
    console.error(`[halkode-test] paySmart3D reddetti · status=${pay.statusCode} · ${pay.error}`);
    return NextResponse.json(
      { ok: false, error: pay.error, statusCode: pay.statusCode },
      { status: 422, headers: h },
    );
  }

  return NextResponse.json({ ok: true, html: pay.html, invoiceId }, { headers: h });
}
