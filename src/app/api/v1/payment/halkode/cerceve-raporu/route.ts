/**
 * Çerçeve teşhis izi — hangi banka 3D ekranını iframe'e sokmuyor?
 *
 * Halköde 3D akışı site içi çerçevede açılıyor; bankanın ACS sayfası
 * X-Frame-Options / CSP ile bunu reddederse istemci tam sayfaya düşer ve buraya
 * tek satır iz bırakır. Amaç ölçmek: hangi POS/banka çerçeveyi kabul etmiyor.
 *
 * 🔴 KART VERİSİ BURAYA GELMEZ ve YAZILMAZ. Kabul edilen alanlar sabittir;
 * gövdede başka ne gelirse gelsin ATILIR (istemciye güvenilmez).
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KAYNAKLAR = new Set(['odeme', 'deneme']);
const SEBEPLER = new Set(['zaman_asimi', 'bos_icerik']);

/** Serbest metni kısa ve zararsız tut: yalnız harf/rakam/boşluk/tire. */
function temizle(v: unknown, enFazla: number): string {
  return typeof v === 'string' ? v.replace(/[^\w\s.-]/g, '').slice(0, enFazla) : '';
}

export async function POST(req: Request) {
  let govde: Record<string, unknown> = {};
  try {
    govde = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const sebep = temizle(govde.sebep, 24);
  const kaynak = temizle(govde.kaynak, 12);
  if (!SEBEPLER.has(sebep) || !KAYNAKLAR.has(kaynak)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  console.warn('[halkode/cerceve] 3D çerçeveye girmedi — tam sayfaya düşüldü', {
    sebep,
    kaynak,
    invoiceId: temizle(govde.invoiceId, 40) || '(yok)',
    posBank: temizle(govde.posBank, 60) || '(bilinmiyor)',
  });

  return NextResponse.json({ ok: true });
}
