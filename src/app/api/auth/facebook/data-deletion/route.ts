/**
 * Facebook (Meta) "User Data Deletion" callback ucu.
 *
 * Meta panelindeki alan için verilecek adres:
 *     https://hesap.viamood.com.tr/api/auth/facebook/data-deletion
 *
 * PROTOKOL (Meta resmî akışı): kullanıcı Facebook ayarlarından uygulamanın
 * verisini sildiğinde Meta bu uca `signed_request` (form-encoded) POST'lar.
 * Başarı cevabı ZORUNLU olarak { url, confirmation_code } içerir; url,
 * kullanıcının talebin durumunu görebileceği sayfadır (/veri-silme-durumu).
 *
 * HTTP SEMANTİĞİ (Meta'nın retry davranışına göre — inceleme bulgusu):
 *  · secret henüz yok / ayarlar okunamadı → 503: Meta talebi DAHA SONRA yeniden
 *    dener, talep kaybolmaz. (200 dönseydik Meta "tamamlandı" sayar, bağlantı
 *    sonsuza dek silinmemiş kalırdı.)
 *  · imza tutmadı / signed_request bozuk  → 400, DB'ye KAYIT YAZILMAZ (kimliksiz
 *    uçta koşulsuz insert = flood kapısı; Meta'nın gerçek istekleri her zaman
 *    geçerli imza taşır).
 *  · imza doğrulandı → önce talep kaydı ('alindi'), sonra silme, sonra durum
 *    güncelle; 200 + confirmation_code yalnız bu dalda döner.
 *
 * SECRET KAYNAĞI: login akışıyla AYNI çözümleme — getFacebookCreds()
 * (env AUTH_FACEBOOK_SECRET öncelikli, yoksa panel/DB; trim'li). İki ucun
 * farklı kaynak okuması sessiz arıza üretirdi (inceleme bulgusu).
 *
 * NE SİLİNİR: accounts satırı (provider='facebook' — token'lar/bağlantı) ve
 * users.image (saf Facebook verisi). Hesap, sipariş ve fatura kayıtları yasal
 * saklama yükümlülüğü gereği durur; tam hesap kapatma destek kanalından yapılır.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, users } from '@/db/schema';
import { veriSilmeTalepleri } from '@/db/schema/veri-silme';
import { getFacebookCreds } from '@/lib/auth/social';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DURUM_URL = 'https://hesap.viamood.com.tr/veri-silme-durumu';

function base64UrlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** signed_request = "<imza>.<payload>" — imza, payload'ın base64url STRING'i üzerinden HMAC-SHA256. */
function parseSignedRequest(
  signedRequest: string,
  appSecret: string,
): { dogrulandi: boolean; userId: string | null } {
  const [sigB64, payloadB64] = signedRequest.split('.');
  if (!sigB64 || !payloadB64) return { dogrulandi: false, userId: null };

  let userId: string | null = null;
  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as { user_id?: string };
    // FB app-scoped id ~17 hane; saldırgan-kontrollü alanı makul boyda tut.
    userId = payload.user_id ? String(payload.user_id).slice(0, 64) : null;
  } catch {
    return { dogrulandi: false, userId: null };
  }

  const beklenen = createHmac('sha256', appSecret).update(payloadB64).digest();
  const gelen = base64UrlDecode(sigB64);
  const dogrulandi = beklenen.length === gelen.length && timingSafeEqual(beklenen, gelen);
  return { dogrulandi, userId };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let signedRequest = '';
  try {
    const form = await req.formData();
    signedRequest = String(form.get('signed_request') ?? '');
  } catch {
    /* form değilse aşağıda 400 */
  }
  if (!signedRequest) {
    return NextResponse.json({ error: 'signed_request gerekli' }, { status: 400 });
  }

  // Login ile aynı secret çözümlemesi (env öncelikli, trim'li). Yoksa 503 →
  // Meta retry eder; talep kaybolmaz, DB'ye de kayıt yazılmaz.
  const creds = await getFacebookCreds().catch(() => null);
  if (!creds?.clientSecret) {
    return NextResponse.json(
      { error: 'Facebook yapılandırması hazır değil, tekrar deneyin' },
      { status: 503, headers: { 'Retry-After': '3600' } },
    );
  }

  const { dogrulandi, userId } = parseSignedRequest(signedRequest, creds.clientSecret);
  if (!dogrulandi || !userId) {
    // İmzasız/bozuk istek DB'ye YAZILMAZ (flood + kuyruk zehirleme önlemi).
    console.warn('[fb-veri-silme] imza doğrulanamadı, istek reddedildi');
    return NextResponse.json({ error: 'signed_request doğrulanamadı' }, { status: 400 });
  }

  // Önce kayıt ('alindi') — silme sonrası insert patlarsa Meta'ya kod dönmüş
  // ama iz kalmamış olurdu. Unique kod çakışmasında bir kez yeniden üret.
  let kod = randomBytes(6).toString('hex');
  try {
    await db.insert(veriSilmeTalepleri).values({ kod, providerUserId: userId });
  } catch {
    kod = randomBytes(6).toString('hex');
    await db.insert(veriSilmeTalepleri).values({ kod, providerUserId: userId });
  }

  let durum = 'kayit-bulunamadi';
  let detay: string | null = 'Bu Facebook hesabıyla bağlı kullanıcı yok (daha önce silinmiş olabilir)';
  let bizdekiUserId: string | null = null;
  try {
    const [acc] = await db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(and(eq(accounts.provider, 'facebook'), eq(accounts.providerAccountId, userId)))
      .limit(1);
    if (acc) {
      bizdekiUserId = acc.userId;
      await db
        .delete(accounts)
        .where(and(eq(accounts.provider, 'facebook'), eq(accounts.providerAccountId, userId)));
      // Profil fotoğrafı saf Facebook verisidir — bağlantıyla birlikte temizlenir.
      await db.update(users).set({ image: null }).where(eq(users.id, acc.userId));
      durum = 'baglanti-silindi';
      detay = null;
    }
  } catch (e) {
    durum = 'alindi';
    detay = `silme sırasında hata: ${e instanceof Error ? e.message : 'bilinmiyor'}`;
  }

  await db
    .update(veriSilmeTalepleri)
    .set({
      durum,
      detay,
      userId: bizdekiUserId,
      completedAt: durum === 'alindi' ? null : new Date(),
    })
    .where(eq(veriSilmeTalepleri.kod, kod));

  // Meta'nın beklediği sözleşme: url + confirmation_code.
  return NextResponse.json({ url: `${DURUM_URL}?kod=${kod}`, confirmation_code: kod });
}

export async function GET(): Promise<NextResponse> {
  return new NextResponse(
    `<!doctype html><html lang="tr"><meta charset="utf-8"><title>Veri Silme — Via Mood</title>
<body style="font-family:system-ui;max-width:640px;margin:48px auto;padding:0 16px;line-height:1.6">
<h1 style="font-size:22px">Facebook verilerinizin silinmesi</h1>
<p>Facebook hesabınızın ayarlar bölümünden ("Uygulamalar ve Web Siteleri") Via Mood
bağlantısını kaldırdığınızda, Facebook üzerinden bize iletilen bağlantı bilgileriniz
otomatik olarak silinir ve size bir takip kodu verilir. Talebinizin durumunu
<a href="/veri-silme-durumu">veri silme durumu</a> sayfasından bu kodla görebilirsiniz.</p>
<p>Hesabınızın tamamının kapatılmasını isterseniz destek@viamood.com adresine yazmanız yeterli.</p>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
