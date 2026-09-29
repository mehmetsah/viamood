import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { userYetkileri } from '@/db/schema/user-yetkileri';

/**
 * Kullanıcının yetkilerini VERİTABANINDAN TAZE okur (#992119-D).
 *
 * ⚠ NEDEN VAR — 29 Eyl 2026'da ÖLÇÜLEN AÇIK:
 * Yetkiler JWT (`token.yetkiler`) içinde taşınıyordu ve yalnız giriş anında DB'den
 * okunuyordu (`maxAge` 7 gün). Ölçüm: yetki `user_yetkileri`'nden SİLİNDİKTEN sonra
 * açık oturum hem SSS sayfasını açmaya hem de yazma action'ını çalıştırmaya DEVAM ETTİ.
 * Yani "tek kayıt silmekle yetki anında geri alınır" iddiası YANLIŞTI — kullanıcı
 * 7 güne kadar erişebiliyordu.
 *
 * Bu yüzden yazma (KAPI 3) ve sayfa (KAPI 2) kapıları artık JWT listesine GÜVENMİYOR,
 * her çağrıda DB'den okuyor. Tek sorgu, sunucu tarafı, `user_id` indeksli.
 *
 * KAPI 1 (middleware) BİLEREK JWT'de kaldı: Edge çalışma ortamında DB sorgusu yapılamaz.
 * O kapı kaba ön elemedir; güvenliği sağlayan asıl kapılar 2 ve 3'tür.
 *
 * Tablo yoksa/okunamazsa boş döner — giriş akışı bu yüzden kırılmaz, ama yetki de
 * VERİLMEZ (güvenli taraf).
 */
export async function yetkileriTazeOku(userId: string | null | undefined): Promise<string[]> {
  if (!userId) return [];
  try {
    const satirlar = await db
      .select({ yetki: userYetkileri.yetki })
      .from(userYetkileri)
      .where(eq(userYetkileri.userId, userId));
    return satirlar.map((s) => s.yetki);
  } catch {
    return [];
  }
}
