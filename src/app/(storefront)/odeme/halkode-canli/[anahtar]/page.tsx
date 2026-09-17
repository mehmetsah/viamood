/**
 * /odeme/halkode-canli/<anahtar> — Halköde 10 TL CANLI deneme sayfası.
 *
 * ⚠️ BU SAYFA GERÇEK PARA ÇEKER. Test sayfasının ikizidir ama üç noktada
 * kasıtlı olarak daha katıdır:
 *
 *  1) ANAHTAR KODA GÖMÜLÜ DEĞİL. Yalnız `HALKODE_CANLI_ANAHTAR` ortam
 *     değişkeninden gelir; tanımsızsa sayfa YOKTUR (404). Test sayfasında
 *     gömülü varsayılan zararsızdı — o yol canlı POS'a bağlanamıyordu.
 *     Burada anahtar, para çeken tek kapının tek kilidi.
 *  2) PANELDEN KAPATILABİLİR. `halkode_canli_deneme` kapalıyken sayfa 404,
 *     uçlar 503 verir. Deneme bitince tek tıkla kapanır, deploy gerekmez.
 *  3) MÜŞTERİ AKIŞINI AÇMAZ. `halkode_enabled` ve `card_gateway`'e
 *     DOKUNMAZ — /odeme'deki normal müşteri hâlâ Halköde göremez.
 *
 * Tutar sunucuda sabit (10,00 TL) ve istemciden ALINMAZ; sipariş/draft
 * yazılmaz (operasyon sahte sipariş görmesin).
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import DenemeSayfasi from '@/components/halkode/DenemeSayfasi';
import { CANLI_ANAHTAR, TEST_TUTAR_TL } from '@/lib/halkode/test-page';
import { getStoreSettings } from '@/lib/settings/store';

export const dynamic = 'force-dynamic';

/** Arama motorlarına KAPALI — canlı müşteri buraya aramadan düşmesin. */
export const metadata: Metadata = {
  title: 'Halköde canlı deneme',
  robots: { index: false, follow: false, nocache: true },
};

export default async function Sayfa({
  params,
  searchParams,
}: {
  params: Promise<{ anahtar: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { anahtar } = await params;
  const sp = await searchParams;

  // Anahtar ortamda tanımsızsa CANLI_ANAHTAR '' olur — boş karşılaştırma
  // herkesi içeri alırdı. Önce varlığı, sonra eşitliği kontrol edilir.
  if (!CANLI_ANAHTAR || anahtar !== CANLI_ANAHTAR) notFound();

  // Kill switch kapalıysa sayfa hiç YOKMUŞ gibi davranır (403 değil 404 —
  // "kapalı" demek sayfanın var olduğunu ele verir).
  const { payment } = await getStoreSettings();
  if (payment.halkode_canli_deneme !== true) notFound();

  return <DenemeSayfasi ortam="canli" anahtar={CANLI_ANAHTAR} tutar={TEST_TUTAR_TL} sp={sp} />;
}
