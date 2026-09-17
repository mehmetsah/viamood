/**
 * Halköde 10 TL TEST ÖDEME SAYFASI — ortak sabitler.
 *
 * NEDEN AYRI BİR SAYFA: Yunus'un akışı denemesi için bugüne kadar sepete ürün
 * atıp adres doldurup /odeme'ye gelmesi gerekiyordu. Tek tıkla açılan, sabit
 * tutarlı, kendi kendine yeten bir sayfa hem daha hızlı hem de sipariş verisini
 * test kayıtlarıyla kirletmiyor: bu akış Shopify draft'ı da RDS siparişi de
 * OLUŞTURMAZ, yalnız Halköde'ye gider ve sonucu ekrana yazar.
 *
 * ⚠️ CANLI POS'A DÜŞMESİ İMKÂNSIZ: sayfa açılırken Halköde önizleme çerezi
 * kurulur; lib/halkode/client.ts cfg() önizlemede taban adresi HER KOŞULDA
 * testapp.halkode.com.tr'ye çiviler — HALKODE_BASE_URL override'ı bile bu yolda
 * geçersizdir. Yani bu sayfadan gerçek para çekilemez.
 */

/** Sabit test tutarı (TL). Halköde items toplamı ile total EŞİT olmalı (yoksa status 13). */
export const TEST_TUTAR_TL = 10.0;

/**
 * Sayfanın adresindeki tahmin edilmesi zor anahtar.
 *
 * Bu bir SIR DEĞİL, bir kapı tokmağı: amacı gerçek müşterinin yanlışlıkla test
 * sayfasına düşmesini önlemek. Gerçek koruma zaten mimaride — sayfa yalnız test
 * ortamına gidebiliyor. O yüzden koda gömülü olması güvenlik açığı değil;
 * env'e bağlansaydı linki değiştirmek için deploy gerekirdi.
 */
export { HALKODE_TEST_ANAHTAR as TEST_ANAHTAR } from './preview-cookie';
import { HALKODE_TEST_ANAHTAR } from './preview-cookie';

export function testYolu(): string {
  return `/odeme/halkode-test/${HALKODE_TEST_ANAHTAR}`;
}

/**
 * Halköde TEST ortamında POS'a TANIMLI kart.
 *
 * Doğrulandı: scripts/halkode-cards.ts taramasında bu BIN getpos'tan 100 döndü
 * ve 1-6 taksit tanımlı çıktı; scripts/halkode-3d-flow.ts uçtan uca bu kartla
 * geçti. Diğer aday kartlar V111 ("test işlemi için tanımlı olmayan kart") verdi.
 *
 * PSP dokümanlarında açıkça yayımlanan TEST kartıdır — gerçek kart değildir,
 * para hareketi yoktur. Bu yüzden ekranda gösterilmesinde sakınca yok; zaten
 * gösterilmezse Yunus'un sayfayı deneyebilmesi mümkün olmaz.
 */
export const TEST_KARTI = {
  no: '4155650100416111',
  sahip: 'Test Kart',
  ay: '12',
  yil: '2028',
  cvv: '555',
  not: 'QNB Finansbank test Visa — testapp POS tanımı var (1-6 taksit)',
} as const;

/** 3D dönüşünde kullanıcıya gösterilecek okunur sonuç sözlüğü. */
export const SONUC_METNI: Record<string, { baslik: string; aciklama: string; iyi: boolean }> = {
  basarili: {
    baslik: 'Ödeme başarılı',
    aciklama:
      'Banka 3D doğrulamasını onayladı ve Halköde işlemi "Completed" olarak döndü. ' +
      'Bu bir TEST işlemidir; hiçbir karttan para çekilmemiştir.',
    iyi: true,
  },
  iptal: {
    baslik: 'İşlem iptal edildi',
    aciklama: 'Banka ekranında işlem iptal edildi ya da doğrulama tamamlanmadan çıkıldı.',
    iyi: false,
  },
  declined: {
    baslik: 'Banka işlemi reddetti',
    aciklama:
      'Kart doğrulandı ama banka çekimi onaylamadı. Test ortamında bu genelde yanlış OTP ' +
      'ya da bilerek reddettirilen senaryodur.',
    iyi: false,
  },
  hash_cozulmedi: {
    baslik: 'Dönüş imzası doğrulanamadı',
    aciklama:
      'Halköde\'nin gönderdiği imza bizim app_secret ile çözülemedi. Sonuç GÜVENİLİR SAYILMADI ' +
      've ödeme kabul edilmedi — bu doğru davranıştır.',
    iyi: false,
  },
  invoice_uyusmuyor: {
    baslik: 'İşlem numarası uyuşmadı',
    aciklama: 'İmzadaki işlem numarası adresteki ile aynı değil; sonuç reddedildi.',
    iyi: false,
  },
  tutar_uyusmuyor: {
    baslik: 'Tutar uyuşmadı',
    aciklama: 'İmzadaki tutar ile bankadan sorulan tutar aynı değil; sonuç reddedildi.',
    iyi: false,
  },
  kapali: {
    baslik: 'Halköde kapalı',
    aciklama: 'Önizleme çerezi düşmüş olabilir. Sayfayı linke tekrar tıklayarak aç.',
    iyi: false,
  },
};
