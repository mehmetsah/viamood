/**
 * /odeme/halkode-test/<anahtar> — Halköde 10 TL TEST ödeme sayfası.
 *
 * Sunucu bileşeni: anahtarı doğrular, noindex verir. Ekranın kendisi TEST ve
 * CANLI sayfa için ORTAK (components/halkode/DenemeSayfasi).
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import DenemeSayfasi from '@/components/halkode/DenemeSayfasi';
import { TEST_ANAHTAR, TEST_TUTAR_TL } from '@/lib/halkode/test-page';

export const dynamic = 'force-dynamic';

/** Arama motorlarına KAPALI — canlı müşteri buraya aramadan düşmesin. */
export const metadata: Metadata = {
  title: 'Halköde test ödemesi',
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

  // Yanlış anahtar → 404. "Yetkisiz" demek bile sayfanın VAR olduğunu ele verir.
  if (anahtar !== TEST_ANAHTAR) notFound();

  // ÇEREZ BURADA KURULMAZ — middleware'de kurulur (src/middleware.ts).
  // Sunucu bileşeni çerez YAZAMIYOR: Next "Cookies can only be modified in a
  // Server Action or Route Handler" ile 500 veriyor. İlk deneme canlıda tam bu
  // hatayla düştü; varsayımla değil hata günlüğüyle bulundu.

  return <DenemeSayfasi ortam="test" anahtar={TEST_ANAHTAR} tutar={TEST_TUTAR_TL} sp={sp} />;
}
