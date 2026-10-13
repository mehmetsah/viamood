/**
 * OTOMATİK E-POSTA AKIŞI — GÖNDERİM AYAĞI (#994057).
 *
 * Zincirin eksik halkasıydı: karar (`eposta-akis.ts`) ve defter
 * (`eposta-akis-kosucu.ts`) 3 Eki'de kurulmuştu ama vakti gelen satırı alıp
 * KUPONU ÜRETEN, ŞABLONU SEÇEN, MAİLİ GÖNDEREN ve sonucu DAMGALAYAN katman
 * hiç yazılmamıştı — yani sistem bir tek mail göndermiyordu (ölçüm: 13 Eki,
 * `grep -rn akisBaslat src/` yalnız testte geçiyordu).
 *
 * TASARIM KURALLARI (gerekçeli):
 *  · HER SATIR KENDİ try/catch'inde — bir müşterinin maili patlayınca turun
 *    geri kalanı düşmez. Hata satıra 'hata' + metin olarak yazılır, SESSİZCE
 *    yutulmaz.
 *  · KUPON FRENİ ADIMI ATLATIR, kuponsuz göndermez: 60 gün freni açıkken
 *    "indirim kodunuz" maili kodsuz giderse müşteriye yalan söylemiş olurduk.
 *  · SMS SAĞLAYICISI YOK: kanal 'sms' çıkan satır 'atlandi' işaretlenir.
 *    Kanal plan anında İYS onayına göre sabitlenir (kosucu'nun notu), burada
 *    yeniden karar verilmez.
 *  · `gonder` ENJEKTE EDİLİR — çivi gerçek mail atmadan tüm dalları koşar.
 */
import { eq } from 'drizzle-orm';
import { ADIMLAR, type Akis } from './eposta-akis';
import { DURUM, bekleyenler, gonderimIsaretle } from './eposta-akis-kosucu';
import { kuponAc } from './eposta-kupon';
import { sendEmail } from './email/sender';
import { akisMaili } from './email/templates';
import { env } from './env';
import { epostaAkisTetikleri } from '@/db/schema';

export interface GonderimOzet {
  tarandi: number;
  gonderildi: number;
  atlandi: number;
  hata: number;
  sebepler: Record<string, number>;
}

type DbGibi = {
  transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
  select: (...a: any[]) => any;
  insert: (...a: any[]) => any;
  update: (...a: any[]) => any;
};

type Gonderici = (p: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tip?: 'pazarlama' | 'duyuru' | 'islemsel';
  sablon?: string;
}) => Promise<{ ok: boolean; error?: string }>;

/** SAF — bu adım kuponlu mu? (tek kaynak: çekirdekteki ADIMLAR tablosu) */
export function kuponluAdimMi(akis: Akis, adim: number): boolean {
  return ADIMLAR[akis]?.find((a) => a.adim === adim)?.kupon === true;
}

/** Sepete/ödemeye dönüş bağlantısı. Sepet yoksa vitrin adresi. */
export function devamUrl(cartToken?: string | null): string {
  const taban = env.STOREFRONT_URL ?? '';
  return cartToken ? `${taban}/sepet?token=${encodeURIComponent(cartToken)}` : taban;
}

function say(o: Record<string, number>, k: string) {
  o[k] = (o[k] ?? 0) + 1;
}

/**
 * BİR TUR: vakti gelmiş satırları gönderir. Zamanlayıcı (cron ucu) bunu çağırır.
 * ⚠ Aynı anda iki tur koşsa bile çift mail gitmez: `(tetik_id, adim)` UNIQUE
 * değil bu turu korur — koruma `durum` geçişindedir; satır 'planlandi' dışına
 * çıkar çıkmaz `bekleyenler` onu bir daha döndürmez.
 */
export async function gonderimTuru(
  db: DbGibi,
  secenek: { simdi?: Date; limit?: number; gonder?: Gonderici } = {},
): Promise<GonderimOzet> {
  const simdi = secenek.simdi ?? new Date();
  const gonder: Gonderici = secenek.gonder ?? ((p) => sendEmail(p as any));
  const satirlar = await bekleyenler(db, simdi, secenek.limit ?? 100);
  const ozet: GonderimOzet = { tarandi: satirlar.length, gonderildi: 0, atlandi: 0, hata: 0, sebepler: {} };

  for (const s of satirlar) {
    try {
      const [tetik] = await db
        .select({
          akis: epostaAkisTetikleri.akis,
          email: epostaAkisTetikleri.email,
          cartId: epostaAkisTetikleri.cartId,
          iptalSebebi: epostaAkisTetikleri.iptalSebebi,
        })
        .from(epostaAkisTetikleri)
        .where(eq(epostaAkisTetikleri.id, s.tetikId))
        .limit(1);

      if (!tetik) {
        await gonderimIsaretle(db, s.id, DURUM.HATA, { hataMetni: 'tetik satırı bulunamadı' });
        ozet.hata += 1; say(ozet.sebepler, 'tetik_yok');
        continue;
      }
      // Akış erken kapandıysa (sipariş verdi / abonelikten çıktı) MAİL GİTMEZ.
      if (tetik.iptalSebebi) {
        await gonderimIsaretle(db, s.id, DURUM.IPTAL);
        ozet.atlandi += 1; say(ozet.sebepler, `iptal:${tetik.iptalSebebi}`);
        continue;
      }
      if (s.kanal === 'sms') {
        await gonderimIsaretle(db, s.id, DURUM.ATLANDI, { hataMetni: 'SMS sağlayıcısı yapılandırılmadı' });
        ozet.atlandi += 1; say(ozet.sebepler, 'sms_saglayici_yok');
        continue;
      }

      const akis = tetik.akis as Akis;
      let kod: string | null = null;
      let kuponId: string | undefined;
      let bitisAni: Date | null = null;

      if (kuponluAdimMi(akis, s.adim)) {
        const k = await kuponAc(db, { email: tetik.email, akis, simdi });
        if (!k.ok) {
          // 60 GÜN FRENİ: kupon verilmez ⇒ kuponlu adım HİÇ gönderilmez.
          await gonderimIsaretle(db, s.id, DURUM.ATLANDI, { hataMetni: `kupon verilmedi: ${k.sebep}` });
          ozet.atlandi += 1; say(ozet.sebepler, `kupon_${k.sebep}`);
          continue;
        }
        kod = k.kod; kuponId = k.id; bitisAni = k.bitisAni;
      }

      const mail = akisMaili({
        akis,
        adim: s.adim,
        kod,
        bitisAni,
        devamUrl: devamUrl(tetik.cartId ? String(tetik.cartId) : null),
      });
      if (!mail) {
        await gonderimIsaretle(db, s.id, DURUM.ATLANDI, { hataMetni: `şablon yok: ${akis}/${s.adim}` });
        ozet.atlandi += 1; say(ozet.sebepler, 'sablon_yok');
        continue;
      }

      const res = await gonder({
        to: tetik.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        // Üç akışın hepsi PAZARLAMA: abonelikten çıkmış adrese gönderilmez,
        // alt bilgiye çıkış linki + RFC 8058 başlıkları sender.ts'te eklenir.
        tip: 'pazarlama',
        sablon: `akis:${akis}:${s.adim}`,
      });

      if (res.ok) {
        await gonderimIsaretle(db, s.id, DURUM.GONDERILDI, kuponId ? { kuponId } : undefined);
        ozet.gonderildi += 1;
      } else {
        await gonderimIsaretle(db, s.id, DURUM.HATA, { hataMetni: (res.error ?? 'bilinmeyen hata').slice(0, 500), kuponId });
        ozet.hata += 1; say(ozet.sebepler, 'gonderim_hatasi');
      }
    } catch (e) {
      const m = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      try {
        await gonderimIsaretle(db, s.id, DURUM.HATA, { hataMetni: m });
      } catch { /* defter de yazamıyorsa tur devam eder; sayaç hatayı gösterir */ }
      ozet.hata += 1; say(ozet.sebepler, 'istisna');
    }
  }
  return ozet;
}
