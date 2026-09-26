/**
 * POST /api/v1/payment/halkode/initialize
 *
 * Storefront → sepet + adres + KART bilgisi gönderir. Biz:
 *   1) Ödeme öncesi "open" draft/pending sipariş yaratırız (callback complete eder).
 *   2) Halköde token + paySmart3D çağırırız.
 *   3) Bankaya auto-submit eden HTML'i olduğu gibi döneriz → frontend document.write/iframe eder.
 *
 * ⚠️ PCI KAPSAMI — PayTR/İyzico'dan FARKI:
 *   PayTR iframe'inde kart bilgisi bize HİÇ uğramaz. Halköde'nin paySmart3D'sinde kart
 *   numarası/CVV bu uçtan GEÇER. Kart verisi hiçbir yere loglanmaz, saklanmaz, DB'ye
 *   yazılmaz — yalnız Halköde'ye iletilir. Yine de bu uç canlıya alınmadan önce
 *   PCI-DSS SAQ seviyesi Mehmet'in kararına bağlıdır. Alternatif: Halköde'nin
 *   "Linkli Ödeme" servisi (kart bize hiç gelmez).
 *
 * Bu uç HALKODE_ENABLED=true olmadan çalışmaz (kill switch).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getAllowedOrigins } from '@/lib/cors';
import { env } from '@/lib/env';
import { shopifyAdresiKur } from '@/lib/shopify/adres';
import { normalizeTrPhone } from '@/lib/shopify/tr-format';
import { ensureTrCustomer } from '@/lib/shopify/customer-locale';
import { upsertCustomerAddress } from '@/lib/shopify/customer-address';
import { getStore, type StorefrontOrderBody } from '@/lib/store';
import { createNativeCardPendingOrder } from '@/lib/store/native-create-order';
import { trustedDiscountDetailed } from '@/lib/shopify/discount-resolve';
import { kartDenetle } from '@/lib/halkode/kart-dogrula';
import {
  getToken,
  paySmart3D,
  buildInvoiceId,
  halkodeConfigured,
  halkodeEnabled,
  type HalkodeItem,
  odemeOrtami,
} from '@/lib/halkode/client';
import { halkodeOnizlemeOrtami } from '@/lib/halkode/preview';
import { kalemAdiKirp } from '@/lib/halkode/kalem-adi';
import { kalemleriHizala } from '@/lib/halkode/kalem-hizala';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STOREFRONT = env.STOREFRONT_URL;
const ALLOWED = getAllowedOrigins();

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED.includes(origin) ? origin : STOREFRONT;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) });
}

interface HalkodeInitBody {
  line_items: Array<{ variant_id: number; quantity: number; title?: string; price?: number }>;
  shipping_cost?: number;
  shipping_courier?: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  saved_address?: string; // '1' → kayıtlı adres seçildi, tekrar kaydetme (PayTR ile aynı)
  zip?: string;
  customer_id?: number;
  customer_email?: string;
  discount_code?: string;
  discount_amount?: number;
  invoice_type?: string;
  tc_no?: string;
  firma_adi?: string;
  vergi_no?: string;
  vergi_dairesi?: string;
  // Kart (SAKLANMAZ, LOGLANMAZ — yalnız Halköde'ye iletilir)
  cc_holder_name: string;
  cc_no: string;
  expiry_month: string;
  expiry_year: string;
  cvv: string;
  installments_number?: number;
}

function invoiceNote(b: HalkodeInitBody): string {
  const lines: string[] = [];
  if (b.invoice_type === 'kurumsal') {
    lines.push('🏢 KURUMSAL FATURA');
    if (b.firma_adi) lines.push(`   Firma: ${b.firma_adi}`);
    if (b.vergi_no) lines.push(`   Vergi No: ${b.vergi_no} · Dairesi: ${b.vergi_dairesi || '-'}`);
  } else {
    lines.push('👤 BİREYSEL FATURA');
    if (b.tc_no) lines.push(`   TC: ${b.tc_no}`);
  }
  return lines.join('\n');
}

/**
 * Shopify "open" draft order (Halköde ödemesi öncesi).
 * NOT: paytr/initialize'daki createDraftOrder ile aynı şekli üretir. Ortak yardımcıya
 * çıkarmak DOĞRU olur; PayTR CANLI ödeme yolu olduğu için bu iş ayrı/riskli bir
 * refactor olarak bırakıldı (Halköde yayına alınırken birlikte yapılmalı).
 */
async function createDraftOrder(b: HalkodeInitBody, totalTl: number): Promise<number | null> {
  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) return null;
  const phone = normalizeTrPhone(b.phone) ?? '';
  // Adres TEK yerden kurulur (lib/shopify/adres.ts): il adı/kodu normalleşir, posta kodu
  // seçilen ile uymuyorsa BOŞ gider — Shopify ili posta kodundan yeniden yazıyordu (#1164/#1169).
  const { adres: addr, il, zip } = shopifyAdresiKur(b, phone);
  const shippingTl = b.shipping_cost || 0;
  const payload = {
    draft_order: {
      line_items: b.line_items.map((li) => ({ variant_id: li.variant_id, quantity: li.quantity })),
      shipping_address: addr,
      billing_address: addr,
      ...(b.customer_id ? { customer: { id: b.customer_id } } : { email: b.email }),
      email: b.customer_email || b.email,
      tags: 'via-mood-storefront,halkode-pending',
      note: `📍 ${b.first_name} ${b.last_name} · ${b.province}/${b.city}\n💳 Halköde (Halkbank) · ${totalTl.toFixed(2)} TL\n${invoiceNote(b)}`,
      use_customer_default_address: false,
      ...(b.shipping_courier || shippingTl > 0
        ? { shipping_line: { title: b.shipping_courier || 'Standart Kargo (KargoLab)', price: shippingTl.toFixed(2) } }
        : {}),
      ...((b.discount_amount ?? 0) > 0
        ? {
            applied_discount: {
              title: b.discount_code || 'İndirim',
              value_type: 'fixed_amount',
              value: (b.discount_amount ?? 0).toFixed(2),
              amount: (b.discount_amount ?? 0).toFixed(2),
            },
          }
        : {}),
    },
  };
  try {
    const resp = await fetch(
      `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/draft_orders.json`,
      {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!resp.ok) return null;
    const j = (await resp.json()) as { draft_order?: { id?: number } };
    const did = j.draft_order?.id ?? null;
    // Tema sözleşmesi PayTR ile AYNI (21 Eyl 2026): giriş yapmış müşteri yeni adres
    // yazdıysa adres defterine eklenir; kayıtlı adres seçtiyse tekrar yazılmaz.
    if (did && b.customer_id && b.saved_address !== '1') {
      await upsertCustomerAddress({
        customerId: b.customer_id,
        first_name: b.first_name,
        last_name: b.last_name,
        phone: b.phone,
        address1: b.address1,
        address2: b.address2,
        city: b.city,
        province: il,
        zip, // süzülmüş posta kodu
      });
    }
    return did;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const headers = { 'Content-Type': 'application/json', ...cors(req.headers.get('origin')) };

  // ⚠️ CANLI DENEME OTURUMU BU UCU KULLANAMAZ. Canlı önizleme çerezi cfg()'de
  // gateway'i açıyor (gizli 10 TL sayfası çalışsın diye) — ama burası GERÇEK
  // sipariş yolu: Shopify draft'ı ve RDS kaydı üretir. Deneme linkini açmış
  // biri buraya düşerse ortada canlı POS'tan çekilmiş, "test" sanılan gerçek
  // bir sipariş kalırdı. İki yol birbirine karışmasın diye açıkça ayrıldı.
  if ((await halkodeOnizlemeOrtami()) === 'canli') {
    return NextResponse.json(
      { ok: false, error: 'Canlı deneme oturumu açık — normal ödeme bu oturumda kullanılamaz.' },
      { status: 403, headers },
    );
  }
  // Ortam, callback ile AYNI kaynaktan gelir: başlatma canlıda yapılıp
  // doğrulama testte aranırsa ödeme sipariş yazmaz (17 Eyl arızası).
  const ortam = await odemeOrtami();

  if (!(await halkodeEnabled(ortam))) {
    return NextResponse.json({ ok: false, error: 'Halköde kapalı (HALKODE_ENABLED).' }, { status: 503, headers });
  }
  if (!(await halkodeConfigured(ortam))) {
    return NextResponse.json({ ok: false, error: 'Halköde yapılandırılmadı (env eksik).' }, { status: 503, headers });
  }

  let body: HalkodeInitBody;
  try {
    body = (await req.json()) as HalkodeInitBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers });
  }

  const missing: string[] = [];
  if (!body.first_name?.trim()) missing.push('first_name');
  if (!body.last_name?.trim()) missing.push('last_name');
  if (!body.phone?.trim()) missing.push('phone');
  if (!body.email?.includes('@')) missing.push('email');
  if (!body.address1?.trim()) missing.push('address1');
  if (!body.city?.trim()) missing.push('city');
  if (!body.province?.trim()) missing.push('province');
  if (!body.line_items?.length) missing.push('line_items');
  if (!body.cc_no?.trim()) missing.push('cc_no');
  if (!body.cvv?.trim()) missing.push('cvv');
  if (!body.expiry_month?.trim()) missing.push('expiry_month');
  if (!body.expiry_year?.trim()) missing.push('expiry_year');
  if (missing.length) {
    return NextResponse.json({ ok: false, error: 'missing_fields', missing }, { status: 422, headers });
  }

  // Kart ŞEKLİ taslak açılmadan denetlenir: yazım hatalı her deneme Shopify'da bir
  // halkode-pending taslağı bırakmasın. Mesaj kart verisi içermez.
  const kart = kartDenetle(body);
  if (!kart.ok) {
    return NextResponse.json(
      { ok: false, error: 'card_invalid', field: kart.alan, message: kart.mesaj },
      { status: 422, headers },
    );
  }

  // İndirim SUNUCUDA yeniden hesaplanır — istemciden gelen tutara güvenilmez
  // (PayTR/İyzico yollarındaki aynı savunma; 11 Ağu 2026 açığı).
  // Kupon reddedilirse SESSİZCE düşürülmez (PayTR ile aynı sözleşme, Yunus 27 Ağu 2026 —
  // OZEL10): tema `discount_rejected`i tanır, kuponu kaldırıp tutarı günceller.
  const disc = await trustedDiscountDetailed(body.discount_code, body.line_items ?? [], {
    email: body.customer_email || body.email,
    phone: body.phone,
    customerId: body.customer_id,
  });
  if (disc.rejected) {
    return NextResponse.json(
      { ok: false, error: 'discount_rejected', message: `Kupon uygulanamadı: ${disc.rejected}` },
      { status: 422, headers },
    );
  }
  body.discount_amount = disc.amountTl;

  const itemsKurus = body.line_items.reduce((s, li) => s + Math.round(li.price ?? 0) * li.quantity, 0);
  const shipKurus = Math.round((body.shipping_cost || 0) * 100);
  const discKurus = Math.round((body.discount_amount || 0) * 100);
  const totalKurus = itemsKurus + shipKurus - discKurus;
  if (totalKurus <= 0) {
    console.error('[halkode/initialize] indirim sepeti sıfırladı — ödeme başlatılmadı', {
      itemsKurus,
      shipKurus,
      discKurus,
      code: body.discount_code,
    });
    return NextResponse.json(
      { ok: false, error: 'İndirim tutarı sepet toplamını karşılıyor. Lütfen kuponu kaldırıp tekrar deneyin.' },
      { status: 422, headers },
    );
  }
  const totalTl = totalKurus / 100;

  // items TOPLAMI total'a EŞİT olmalı (yoksa Halköde status 13 döner).
  //
  // 🔴 ÖLÇÜLMÜŞ ARIZA (25 Eyl 2026, 10 başarısız / 3 başarılı ödeme):
  // `price` alanına SATIR TOPLAMI yazılıp `quantity` de ayrıca gönderiliyordu.
  // Halköde kalem tutarını `price × quantity` olarak hesapladığı için adet 1'den
  // büyük her sepette toplam şişiyor ve status 13 dönüyordu:
  //   "The total of your items price 8100.0000 is not equal to the invoice total (8100.0000)"
  // (iki sayı mesajda aynı görünür — Halköde ham toplamı basar, kendi çarpımını değil.)
  // Doğrusu: price = BİRİM fiyat. Böylece Halköde'nin çarpımı itemsKurus ile örtüşür.
  const items: HalkodeItem[] = body.line_items.map((li) => ({
    name: kalemAdiKirp(li.title || `Ürün ${li.variant_id}`),
    price: Math.round(li.price ?? 0) / 100,
    quantity: li.quantity,
  }));
  if (shipKurus > 0) items.push({ name: 'Kargo', price: shipKurus / 100, quantity: 1 });
  if (discKurus > 0) items.push({ name: 'İndirim', price: -discKurus / 100, quantity: 1 });

  // İKİNCİ KAPI — kuruş sapması. Yukarıdaki düzeltme çarpımı hizalar ama ondalık
  // toplama hâlâ 1 kuruş kayabilir (ör. 2699,99 × 3). Sapma varsa son kaleme
  // yazılır; böylece Halköde'ye giden items toplamı total'a KURUŞU KURUŞUNA eşit olur.
  // Kapı artık SAF bir fonksiyonda (src/lib/halkode/kalem-hizala.ts) — burada
  // gömülü olduğu sürece ÇİVİLENEMİYORDU: sapma bugünkü girdi uzayında matematiksel
  // olarak doğmadığı için ürün kodu yoluyla tetiklenemiyor, dolayısıyla Okan'ın
  // `sapmaKurus = 0` mutasyonu hiçbir iddiayı kırmıyordu (26 Eyl denetimi, MUT-E).
  // Davranış AYNI; değişen tek şey ölçülebilirlik.
  const hiza = kalemleriHizala(items, totalKurus);
  const gonderilecekItems = hiza.items;
  if (hiza.duzeltildi) {
    console.warn('[halkode/initialize] kalem toplamı düzeltildi', {
      sapmaKurus: hiza.sapmaKurus,
      totalKurus,
    });
  }

  await ensureTrCustomer(body.customer_email || body.email);

  const draftId =
    (await getStore()).backend === 'native'
      ? await createNativeCardPendingOrder(body as unknown as StorefrontOrderBody)
      : await createDraftOrder(body, totalTl);
  const invoiceId = buildInvoiceId(draftId, Date.now().toString(36));

  const t = await getToken(ortam);
  if (!t.ok) {
    console.error('[halkode/initialize] token alınamadı', { invoiceId, error: t.error });
    return NextResponse.json({ ok: false, error: 'halkode_token_failed', detail: t.error }, { status: 502, headers });
  }

  const pay = await paySmart3D(
    {
      ccHolderName: body.cc_holder_name || `${body.first_name} ${body.last_name}`,
      ccNo: kart.ccNo,
      expiryMonth: kart.ay,
      expiryYear: kart.yil,
      cvv: kart.cvv,
      total: totalTl,
      installmentsNumber: body.installments_number || 1,
      invoiceId,
      invoiceDescription: `Via Mood siparişi`,
      name: body.first_name,
      surname: body.last_name,
      // ⚠ HİZALANMIŞ dizi gider. Eski kod `items`'ı YERİNDE değiştiriyordu; saf
      // fonksiyon kopya döndürdüğü için burada `items` bırakmak sapma düzeltmesini
      // SESSİZCE düşürürdü (status 13 geri gelir). Ölçüldü ve yakalandı.
      items: gonderilecekItems,
      returnUrl: `${env.APP_URL}/api/v1/payment/halkode/callback`,
      cancelUrl: `${env.APP_URL}/api/v1/payment/halkode/callback`,
    },
    t.token,
    ortam,
  );

  if (!pay.ok) {
    // Kart verisi ASLA loglanmaz — yalnız invoice + Halköde durum kodu.
    console.error('[halkode/initialize] paySmart3D reddetti', {
      invoiceId,
      draftId,
      statusCode: pay.statusCode,
      error: pay.error,
    });
    return NextResponse.json(
      { ok: false, error: 'halkode_payment_failed', status_code: pay.statusCode, detail: pay.error },
      { status: 502, headers },
    );
  }

  // Bankaya auto-submit eden HTML — frontend bunu iframe/document.write ile basar.
  return NextResponse.json({ ok: true, invoice_id: invoiceId, form_html: pay.html }, { status: 200, headers });
}
