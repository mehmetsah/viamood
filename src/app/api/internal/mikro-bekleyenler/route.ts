/**
 * GET /api/internal/mikro-bekleyenler?key=<INTERNAL_API_KEY>[&gun=90][&durum=failed|pending|hepsi]
 *
 * Mikro'ya AKTARILAMAMIŞ siparişleri listeler. Salt-okunur — hiçbir şey yazmaz,
 * hiçbir push tetiklemez.
 *
 * NEDEN VAR (#428): `orders.mikro_sync_status` panelde HİÇBİR YERDE görünmüyordu
 * (16 Eyl 2026 ölçümü: alan yalnız bu klasördeki auto-fulfill ucunda geçiyor,
 * tek bir admin ekranında bile yok). Başarısız push için retry de yok. Sonuç:
 * ödenmiş siparişler sessizce Mikro dışında kalıyor ve kimse fark etmiyor —
 * ölçümde en eskisi 16 Temmuz tarihliydi, iki aydır öyle duruyordu.
 *
 * Bu uç o körlüğü kapatır: neyin, ne zamandan beri, hangi hatayla takıldığını
 * tek çağrıda gösterir. Düzeltme kararı (Mikro'da stok kodu açmak, yeniden
 * itmek) insana aittir — bu uç yalnız GÖSTERİR.
 *
 * Yetki: key, INTERNAL_API_KEY ile birebir eşleşmeli (auto-fulfill ile aynı desen).
 */
import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { and, desc, gt, ne, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function keyOk(key: string | null): boolean {
  const secret = env.INTERNAL_API_KEY;
  if (!secret || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Kaç gün geriye bakılacak — makul sınırlar içinde tutulur. */
function gunSayisi(ham: string | null): number {
  const n = Number(ham);
  if (!Number.isFinite(n)) return 90;
  return Math.min(Math.max(Math.trunc(n), 1), 365);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (!keyOk(sp.get('key'))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const gun = gunSayisi(sp.get('gun'));
  const durum = sp.get('durum') ?? 'failed';
  const esikTarih = new Date(Date.now() - gun * 24 * 60 * 60 * 1000);

  // 'approved' DIŞINDAKİ her şey "aktarılamamış" sayılır; istenirse tek duruma daraltılır.
  const durumKosulu =
    durum === 'hepsi'
      ? ne(orders.mikroSyncStatus, 'approved')
      : sql`${orders.mikroSyncStatus}::text = ${durum}`;

  const satirlar = await db
    .select({
      siparis: sql<string>`coalesce(${orders.shopifyOrderName}, ${orders.orderNumber}::text)`,
      durum: sql<string>`${orders.mikroSyncStatus}::text`,
      olusturuldu: orders.createdAt,
      odeme: sql<string>`coalesce(${orders.financialStatus}::text, '-')`,
      hata: sql<string | null>`left(${orders.mikroError}, 200)`,
      evrakSeri: orders.mikroEvrakSeri,
    })
    .from(orders)
    .where(and(gt(orders.createdAt, esikTarih), durumKosulu))
    .orderBy(desc(orders.createdAt))
    .limit(200);

  const simdi = Date.now();
  const liste = satirlar.map((s) => ({
    ...s,
    // "Ne kadar zamandır takılı" — asıl bakılması gereken sayı bu.
    bekleyenGun: Math.floor((simdi - new Date(s.olusturuldu).getTime()) / 86_400_000),
  }));

  // Hata metnine göre kümele: aynı kök nedenin kaç siparişi etkilediği tek bakışta görünsün.
  const kokNeden = new Map<string, number>();
  for (const s of liste) {
    const anahtar = (s.hata ?? '(hata kaydı yok)').slice(0, 60);
    kokNeden.set(anahtar, (kokNeden.get(anahtar) ?? 0) + 1);
  }

  // ÖDEME DURUMU AYRIMI ŞART: 16 Eyl ölçümünde 5 başarısız siparişin 2'si iade
  // edilmiş, 1'i hiç ödenmemişti. Yalnız 'paid' olanlar gerçekten "parası alındı
  // ama Mikro'da yok" demektir — acil bakılacak küme odur. Toplam sayıya bakıp
  // telaşa kapılmamak için bu ayrım JSON'da hazır verilir.
  const odemeKirilimi = new Map<string, number>();
  for (const s of liste) odemeKirilimi.set(s.odeme, (odemeKirilimi.get(s.odeme) ?? 0) + 1);
  const odenmisler = liste.filter((s) => s.odeme === 'paid');

  return NextResponse.json({
    ok: true,
    sorgu: { gun, durum },
    adet: liste.length,
    enEskiBekleyenGun: liste.length ? Math.max(...liste.map((s) => s.bekleyenGun)) : 0,
    /** Asıl bakılacak küme: parası alınmış ama Mikro'ya girmemiş siparişler. */
    odenmisAdet: odenmisler.length,
    odenmisSiparisler: odenmisler.map((s) => s.siparis),
    odemeKirilimi: Object.fromEntries(odemeKirilimi),
    kokNedenler: [...kokNeden.entries()]
      .map(([hata, adet]) => ({ hata, adet }))
      .sort((a, b) => b.adet - a.adet),
    liste,
  });
}
