/**
 * DAVET LİNKİ — servis (DB) katmanı · #992317
 *
 * Bu dosya `src/lib/password-reset.ts`'in KARDEŞİDİR: yeni bir güvenlik deseni
 * icat edilmedi, ölçülmüş ve çalışan desen tekrarlandı. Kuralların KENDİSİ
 * burada DEĞİL, `src/lib/davet.ts`'te (saf, DB'siz) durur ve buradan ÇAĞRILIR —
 * kuralın iki kopyası olursa biri güncellenmeyince sessizce ayrışır.
 *
 * Güvenlik değişmezleri (bunları bozma):
 *  1. Ham token DB'de DURMAZ — linkte ham, DB'de SHA-256 özeti (`tokenHash`).
 *  2. Token TEK KULLANIMLIK ve 24 saat süreli; tüketilince `usedAt` damgalanır
 *     ⇒ link ölür. Aynı e-postanın bekleyen diğer davetleri de iptal edilir.
 *  3. DIŞARIYA TEK HÜKÜM ÇIKAR. "kayıt yok" · "süresi geçmiş" · "kullanılmış"
 *     hâlleri ayırt EDİLEMEZ (bkz. davetHukmu). Ayrım içeride kalır.
 *  4. ROL SUNUCUDA, DAVET SATIRINDAN okunur — istemciden/linkten ASLA. Üstelik
 *     davetle verilebilecek roller BEYAZ LİSTEyle sınırlıdır: `admin` ve
 *     `super_admin` bir e-posta bağlantısıyla ele geçirilemez (#992147 ile aynı
 *     ilke: dar rol ver, tam admin verme).
 *
 * ⚠ E-POSTA GÖNDERİMİ BU KATMANDA YOKTUR — bilinçli. `davetKaydiOlustur` linki
 *   DÖNDÜRÜR, göndermez; gönderim katmanı ayrı bir karttır. Böylece bu dosya
 *   çağrıldığında kazara kimseye davet gitmez.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { inviteTokens, sessions, users } from '@/db/schema';
import { DAVET_OMRU_MS, davetHukmu, davetTokenUret, tokenOzeti } from '@/lib/davet';
import { env } from '@/lib/env';
import { hashPassword } from '@/lib/password';

/**
 * Davet linkiyle VERİLEBİLEN roller.
 *
 * `admin` / `super_admin` kasten YOK: bir posta kutusuna düşen bağlantı, tam
 * yönetici yetkisi devretmek için yeterli bir kimlik kanıtı değildir.
 * ⚠ `sss_editor` `user_role` enum'una henüz EKLENMEDİ (göç manuel onay bekliyor:
 *   drizzle/MANUEL-A-SIKKI-user_role-enum.sql). Enum'a girene kadar bu rolle
 *   davet DB düzeyinde düşer — sessizce başka bir rol atanmaz.
 */
export const DAVET_EDILEBILIR_ROLLER = ['customer', 'vendor', 'vendor_admin', 'sss_editor'] as const;
export type DavetEdilebilirRol = (typeof DAVET_EDILEBILIR_ROLLER)[number];

export function davetRoluGecerliMi(rol: string): rol is DavetEdilebilirRol {
  return (DAVET_EDILEBILIR_ROLLER as readonly string[]).includes(rol);
}

export function davetUrlKur(token: string): string {
  return `${env.APP_URL.replace(/\/$/, '')}/auth/davet?token=${encodeURIComponent(token)}`;
}

export type DavetOlusturSonuc =
  | { ok: true; link: string; expiresAt: Date }
  | { ok: false; sebep: 'rol_izinli_degil' | 'eposta_gecersiz' };

/**
 * Davet kaydı açar ve linki DÖNDÜRÜR (göndermez).
 * Çağıran taraf yetkilendirmeyi kendi kapısında yapmış olmalıdır; bu katman
 * yetkiye değil, rolün davet edilebilirliğine bakar (ikinci kapı).
 */
export async function davetKaydiOlustur(params: {
  email: string;
  role: string;
  userId?: string | null;
  invitedBy?: string | null;
  ip?: string | null;
}): Promise<DavetOlusturSonuc> {
  const email = params.email.toLowerCase().trim();
  if (!email || !email.includes('@')) return { ok: false, sebep: 'eposta_gecersiz' };
  if (!davetRoluGecerliMi(params.role)) return { ok: false, sebep: 'rol_izinli_degil' };

  const { ham, ozet, expiresAt } = davetTokenUret();
  await db.insert(inviteTokens).values({
    userId: params.userId ?? null,
    email,
    role: params.role,
    tokenHash: ozet,
    expiresAt,
    invitedBy: params.invitedBy ?? null,
    requestIp: params.ip?.trim() || null,
  });

  // Teşhis: TOKEN ve LİNK log'lanmaz — log'a düşen bir link, paylaşılmış paroladır.
  console.info(`[davet] kayıt açıldı · rol=${params.role} · ömür=${DAVET_OMRU_MS / 3600000}sa`);
  return { ok: true, link: davetUrlKur(ham), expiresAt };
}

/** Dışarıya dönen tek hüküm — sebep AYRIMI YOK (değişmez 3). */
export type DavetKontrol =
  | { gecerli: true; email: string; role: string; userId: string | null }
  | { gecerli: false };

/** Token'ı doğrular ama TÜKETMEZ — parola formunu göstermeden önce kullanılır. */
export async function davetKontrol(token: string): Promise<DavetKontrol> {
  if (!token) return { gecerli: false };

  const [row] = await db
    .select({
      userId: inviteTokens.userId,
      email: inviteTokens.email,
      role: inviteTokens.role,
      expiresAt: inviteTokens.expiresAt,
      usedAt: inviteTokens.usedAt,
    })
    .from(inviteTokens)
    .where(eq(inviteTokens.tokenHash, tokenOzeti(token)))
    .limit(1);

  // Karar SAF KATMANDA verilir; burada ikinci bir süre/kullanım kuralı yazılmaz.
  if (!row || davetHukmu(row) !== 'gecerli') return { gecerli: false };
  return { gecerli: true, email: row.email, role: row.role, userId: row.userId ?? null };
}

export type DavetTuketSonuc = { ok: true; email: string } | { ok: false };

/**
 * Token'ı tüketir, kullanıcının KENDİ parolasını yazar ve rolü davet satırından atar.
 *
 * Yarış koşulu koruması: `usedAt` güncellemesi KOŞULLU (`used_at IS NULL`).
 * İki istek aynı anda gelirse yalnız biri damgalayabilir — ikincisi `{ok:false}`.
 * Süre kontrolü SQL'e gömülmez; tek kaynak `davetHukmu`dur (yukarıdaki kontrol).
 */
export async function davetTuket(params: { token: string; newPassword: string }): Promise<DavetTuketSonuc> {
  const kontrol = await davetKontrol(params.token);
  if (!kontrol.gecerli) return { ok: false };

  const ozet = tokenOzeti(params.token);
  const alinan = await db
    .update(inviteTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(inviteTokens.tokenHash, ozet), isNull(inviteTokens.usedAt)))
    .returning({ userId: inviteTokens.userId, email: inviteTokens.email, role: inviteTokens.role });

  const kayit = alinan[0];
  if (!kayit) return { ok: false }; // yarışı öteki istek kazandı

  // Rol DAVET SATIRINDAN gelir; ikinci kapı olarak beyaz liste yine sorulur —
  // satır elle/geçmiş bir göçle kirlenmişse yükseltme buradan da geçmez.
  if (!davetRoluGecerliMi(kayit.role)) return { ok: false };

  const passwordHash = await hashPassword(params.newPassword);
  if (kayit.userId) {
    try {
      await db
        .update(users)
        .set({ passwordHash, role: kayit.role as (typeof users.$inferInsert)['role'] })
        .where(eq(users.id, kayit.userId));
    } catch (e) {
      // ⚠ DAMGAYI GERİ AL. Ölçülmüş risk: `sss_editor` `user_role` enum'unda henüz
      // YOK (göç manuel onayda). Rol yazımı düşerse token zaten damgalanmıştır ve
      // geri alınmazsa davet edilen kişi parolasını BİR DAHA HİÇ belirleyemez —
      // link ölmüş, parola yazılmamış olur. O yüzden damga geri çevrilir ve link
      // yeniden denenebilir kalır.
      await db.update(inviteTokens).set({ usedAt: null }).where(eq(inviteTokens.tokenHash, ozet));
      console.error(`[davet] rol yazılamadı, damga geri alındı · rol=${kayit.role}`);
      return { ok: false };
    }
    // Bekleyen DİĞER davetleri iptal et — eski bir mail hâlâ kutudaysa işe yaramasın.
    await db
      .update(inviteTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(inviteTokens.userId, kayit.userId), isNull(inviteTokens.usedAt)));
    // Parola belirlendi ⇒ eski oturumlar geçersiz.
    await db.delete(sessions).where(eq(sessions.userId, kayit.userId));
  }

  return { ok: true, email: kayit.email };
}
