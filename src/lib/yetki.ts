/**
 * Rol yetkileri — TEK KAYNAK.
 *
 * Mehmet ŞAH, 29 Eyl 2026 13:10 panel: «SSS rolünü yaz». Yunus'a `admin` rolü
 * VERİLMEYECEK — o rol 37 admin ekranının hepsini açıyor. Yerine yalnız ürün SSS
 * ekranına erişen bir rol var: `sss_editor`.
 *
 * ⚠ İZOLASYON SUNUCUDA ZORLANIR. Menüden gizlemek teslim SAYILMAZ: menü yalnız
 * görüntüdür, adres çubuğuna `/admin/orders` yazan biri için hiçbir şey ifade etmez.
 * Kapılar üç katmanda:
 *   1) middleware  — /admin/* yol bazlı (sss_editor yalnız /admin/urun-sss)
 *   2) admin layout — sunucu bileşeni, doğrudan render denemesine karşı
 *   3) server action — asıl yazma yolu; layout'u atlayan POST'a karşı
 */

export const SSS_EDITOR = 'sss_editor' as const;

/** Tüm admin ekranlarını görebilen roller. */
export const TAM_ADMIN_ROLLER = ['admin', 'super_admin'] as const;

/** SSS ekranını görebilen roller (tam adminler de dahil). */
export const SSS_ROLLER = [...TAM_ADMIN_ROLLER, SSS_EDITOR] as const;

/** sss_editor'ün girebildiği TEK admin yolu. */
export const SSS_YOL = '/admin/urun-sss';

export function tamAdminMi(rol: unknown): boolean {
  return TAM_ADMIN_ROLLER.includes(rol as (typeof TAM_ADMIN_ROLLER)[number]);
}

/**
 * SSS verisini okuyup yazabilir mi? — **TEK KARAR NOKTASI**.
 *
 * İKİ kaynaktan biri yeterli:
 *   (a) rol `admin` / `super_admin` / `sss_editor`
 *   (b) `user_yetkileri` tablosunda `sss_editor` kaydı (B şıkkı — GERİ ALINABİLİR)
 *
 * (a)'daki `sss_editor` rolü BİLEREK duruyor: `user_role` enum'u ileride genişletilirse
 * (A şıkkı) bu kod kırılmasın. Bugün enum'da yok, ölçüldü — o yüzden (b) var.
 *
 * Üç kapı (middleware · admin layout · server action) bu AYNI fonksiyonu çağırır;
 * kapı sayısı artmadı, karar noktası tek.
 */
export function sssYonetebilirMi(rol: unknown, yetkiler?: readonly string[] | null): boolean {
  if (SSS_ROLLER.includes(rol as (typeof SSS_ROLLER)[number])) return true;
  return Array.isArray(yetkiler) && yetkiler.includes(SSS_EDITOR);
}

/**
 * Bu rol, istenen /admin yoluna girebilir mi?
 * sss_editor için SSS_YOL ve alt yolları dışında her şey KAPALI.
 */
export function adminYoluAcikMi(
  rol: unknown,
  pathname: string,
  yetkiler?: readonly string[] | null,
): boolean {
  if (tamAdminMi(rol)) return true;
  // Rolden ya da yetki kaydından gelsin, karar AYNI fonksiyondan çıkar.
  if (sssYonetebilirMi(rol, yetkiler)) {
    return pathname === SSS_YOL || pathname.startsWith(`${SSS_YOL}/`);
  }
  return false;
}
