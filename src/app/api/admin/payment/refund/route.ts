/**
 * KART İADESİ — admin ucu (Halköde).
 *
 * 🔴 NEDEN ADMIN ALTINDA: iade PARA ÇIKIŞIDIR. Müşteriye açık bir sayfada
 * "sipariş no + tutar" ile tetiklenebilseydi, sipariş numaraları sıralı olduğu
 * için başkasının numarası denenebilirdi. Bu yüzden uç oturum arkasında ve
 * yalnız admin/super_admin rolüne açık.
 *
 * Akış:
 *   1) yetki → 2) invoice_id çöz → 3) `pending` kayıt YAZ (istek gitmeden önce!)
 *   4) Halköde /api/refund → 5) kaydı success/failed yap → 6) Shopify'a not düş
 *
 * ⚠️ 3. adım bilerek istekten ÖNCE: 17 Eyl'de para çekilip sistemde iz kalmaması
 * en pahalı arızaydı. Burada istek gönderilmeden satır açılır; cevap gelmezse
 * bile `pending` satırı "istek gitti, sonucu bilinmiyor" der ve elle sorgulanır.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { orders, paymentRefunds } from '@/db/schema';
import { getToken, refund, odemeOrtami, halkodeConfigured, parseDraftIdFromInvoiceId } from '@/lib/halkode/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Govde {
  invoice_id?: string;
  order_no?: string;
  amount?: number;
  note?: string;
}

export async function POST(req: NextRequest) {
  // ── 1) YETKİ ───────────────────────────────────────────────────────────
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin')) {
    return NextResponse.json({ ok: false, error: 'yetkisiz' }, { status: 403 });
  }
  const kim = session.user.email || session.user.id;

  let b: Govde;
  try {
    b = (await req.json()) as Govde;
  } catch {
    return NextResponse.json({ ok: false, error: 'gecersiz_json' }, { status: 400 });
  }

  const tutarTl = Number(b.amount);
  if (!Number.isFinite(tutarTl) || tutarTl <= 0) {
    return NextResponse.json({ ok: false, error: 'tutar_gecersiz' }, { status: 400 });
  }

  // ── 2) invoice_id ÇÖZ ──────────────────────────────────────────────────
  // Sipariş kaydında invoice_id alanı YOK (ödeme başlatılırken yalnız Halköde'ye
  // gidiyor). Bu yüzden: açıkça verilmişse onu kullan; verilmemişse aynı siparişe
  // ait ÖNCEKİ iade kaydından öğren. İkisi de yoksa uydurma — operatöre söyle.
  let invoiceId = (b.invoice_id || '').trim();
  let siparis: typeof orders.$inferSelect | undefined;

  const orderNo = (b.order_no || '').trim().replace(/^#/, '');
  if (orderNo) {
    [siparis] = await db.select().from(orders).where(eq(orders.orderNumber, orderNo)).limit(1);
    if (!siparis) {
      [siparis] = await db.select().from(orders).where(eq(orders.shopifyOrderName, `#${orderNo}`)).limit(1);
    }
  }

  if (!invoiceId && siparis) {
    const [onceki] = await db
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.orderId, siparis.id))
      .orderBy(desc(paymentRefunds.createdAt))
      .limit(1);
    if (onceki) invoiceId = onceki.invoiceId;
  }

  if (!invoiceId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invoice_bulunamadi',
        detay:
          'Bu siparişin Halköde işlem numarası (invoice_id) sistemde kayıtlı değil. ' +
          'Halköde panelinden işlem numarasını alıp "İşlem No" alanına girin.',
      },
      { status: 422 },
    );
  }

  // invoice_id sipariş kimliği gömülü taşıyor — order verilmediyse oradan bul
  if (!siparis) {
    const draftId = parseDraftIdFromInvoiceId(invoiceId);
    if (draftId) {
      [siparis] = await db.select().from(orders).where(eq(orders.shopifyOrderId, draftId)).limit(1);
    }
  }

  const ortam = await odemeOrtami();
  if (!(await halkodeConfigured(ortam))) {
    return NextResponse.json(
      { ok: false, error: 'halkode_yapilandirilmamis', detay: 'Halköde kimlikleri eksik; iade gönderilemez.' },
      { status: 503 },
    );
  }

  // ── 3) KAYIT ÖNCE (istek gitmeden) ─────────────────────────────────────
  const tutarKurus = BigInt(Math.round(tutarTl * 100));
  const [kayit] = await db
    .insert(paymentRefunds)
    .values({
      orderId: siparis?.id ?? null,
      orderName: siparis?.shopifyOrderName ?? siparis?.orderNumber ?? (orderNo || null),
      invoiceId,
      gateway: 'halkode',
      amountCents: tutarKurus,
      status: 'pending',
      requestedBy: kim,
      note: b.note || null,
    })
    .returning();

  if (!kayit) {
    // returning() boş dönerse iadeyi GÖNDERMEYİZ: kaydı olmayan para hareketi
    // tam olarak 17 Eyl'de yaşanan "iz bırakmayan işlem" durumudur.
    return NextResponse.json({ ok: false, error: 'kayit_acilamadi' }, { status: 500 });
  }

  // ── 4) HALKÖDE'YE GÖNDER ───────────────────────────────────────────────
  const t = await getToken(ortam);
  if (!t.ok) {
    await db
      .update(paymentRefunds)
      .set({ status: 'failed', description: `token alınamadı: ${t.error}`, updatedAt: new Date() })
      .where(eq(paymentRefunds.id, kayit.id));
    return NextResponse.json({ ok: false, error: 'token_alinamadi', kayit_id: kayit.id }, { status: 502 });
  }

  const sonuc = await refund(invoiceId, tutarTl, t.token, ortam);

  // ── 5) SONUCU YAZ ──────────────────────────────────────────────────────
  // ⚠️ `raw`'a sır alanı yazılmaz: merchant_key/app_secret cevapta dönmez ama
  // dönse bile buraya süzülmemeli. refund() yalnız data/status döndürür.
  await db
    .update(paymentRefunds)
    .set({
      status: sonuc.ok ? 'success' : 'failed',
      statusCode: String(sonuc.statusCode),
      description: sonuc.description,
      raw: sonuc.data as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(paymentRefunds.id, kayit.id));

  // ── 6) SHOPIFY NOTU (başarılıysa) ──────────────────────────────────────
  let notDurum: string | null = null;
  if (sonuc.ok && siparis?.shopifyOrderId) {
    try {
      const m = await import('@/lib/halkode/iade-not');
      notDurum = await m.shopifySiparisNotuEkle(siparis.shopifyOrderId, {
        tutarTl,
        tarih: new Date(),
        durum: 'başarılı',
        invoiceId,
      });
    } catch (e) {
      notDurum = `not yazılamadı: ${e instanceof Error ? e.message : String(e)}`;
    }
    await db
      .update(paymentRefunds)
      .set({ shopifyNoted: notDurum, updatedAt: new Date() })
      .where(eq(paymentRefunds.id, kayit.id));
  }

  return NextResponse.json(
    {
      ok: sonuc.ok,
      kayit_id: kayit.id,
      invoice_id: invoiceId,
      tutar_tl: tutarTl,
      status_code: sonuc.statusCode,
      aciklama: sonuc.description,
      siparis: siparis?.shopifyOrderName ?? siparis?.orderNumber ?? null,
      shopify_not: notDurum,
    },
    { status: sonuc.ok ? 200 : 422 },
  );
}
