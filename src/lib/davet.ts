/**
 * DAVET LİNKİ — saf sunucu mantığı (#992317).
 *
 * Mehmet'in kuralı (30 Eyl 2026): parola düz metin paylaşılmaz; link gönderilir,
 * karşı taraf KENDİ parolasını oluşturur, link 24 saat geçerlidir ve parola
 * oluşturulunca ölür.
 *
 * Bu dosya BİLEREK saf (DB'siz) tutuldu: kararların hepsi burada, test edilebilir
 * biçimde. DB'ye yazan/okuyan katman bunu ÇAĞIRIR, kuralı kendi yeniden yazmaz —
 * kuralın iki kopyası olursa biri güncellenmeyince sessizce ayrışır.
 */
import crypto from 'node:crypto';

/** Davet linkinin ömrü. Tek yer — çağıranlar bu sabiti kullanır, kendi sayı yazmaz. */
export const DAVET_OMRU_SAAT = 24;
export const DAVET_OMRU_MS = DAVET_OMRU_SAAT * 60 * 60 * 1000;

/**
 * Yeni davet token'ı üretir.
 * Dönen `ham` YALNIZ linke konur ve bir daha asla elde edilemez; DB'ye `ozet` gider.
 */
export function davetTokenUret(now: Date = new Date()): {
  ham: string;
  ozet: string;
  expiresAt: Date;
} {
  // 32 bayt = 256 bit entropi. Math.random KULLANILMAZ — tahmin edilebilir.
  const ham = crypto.randomBytes(32).toString('base64url');
  return { ham, ozet: tokenOzeti(ham), expiresAt: new Date(now.getTime() + DAVET_OMRU_MS) };
}

/** Ham token → DB'de saklanan SHA-256 özeti. Tek yön; özetten ham token dönülemez. */
export function tokenOzeti(ham: string): string {
  return crypto.createHash('sha256').update(ham).digest('hex');
}

/** Bir davet kaydının dışarıya dönen tek hükmü. */
export type DavetHuküm = 'gecerli' | 'gecersiz';

/**
 * Kaydın geçerli olup olmadığına SUNUCUDA karar verir.
 *
 * ⚠ KASITLI TASARIM — "yok", "süresi geçmiş" ve "kullanılmış" hâllerinin ÜÇÜ DE
 * `'gecersiz'` döner. Ayrı mesaj vermek, elinde token olan birine "bu token VARDI
 * ama süresi geçti" bilgisini sızdırır ve token uzayını taramayı kolaylaştırır.
 * Ayrım içeride (kütük/iz) tutulur, dışarıya TEK yanıt çıkar.
 */
export function davetHukmu(
  kayit: { expiresAt: Date; usedAt: Date | null } | null | undefined,
  now: Date = new Date(),
): DavetHuküm {
  if (!kayit) return 'gecersiz';
  if (kayit.usedAt) return 'gecersiz';
  if (kayit.expiresAt.getTime() <= now.getTime()) return 'gecersiz';
  return 'gecerli';
}

/**
 * Parola belirlenirken token'ın tüketilip tüketilemeyeceği.
 * `davetHukmu` ile AYNI kuralı kullanır — ikinci bir kural yazılmaz.
 */
export function davetTuketilebilirMi(
  kayit: { expiresAt: Date; usedAt: Date | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  return davetHukmu(kayit, now) === 'gecerli';
}
