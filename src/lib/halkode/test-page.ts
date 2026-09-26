/**
 * Halköde 10 TL DENEME ÖDEME SAYFALARI — ortak sabitler (TEST ve CANLI).
 *
 * NEDEN AYRI BİR SAYFA: Yunus'un akışı denemesi için bugüne kadar sepete ürün
 * atıp adres doldurup /odeme'ye gelmesi gerekiyordu. Tek tıkla açılan, sabit
 * tutarlı, kendi kendine yeten bir sayfa hem daha hızlı hem de sipariş verisini
 * test kayıtlarıyla kirletmiyor: bu akış Shopify draft'ı da RDS siparişi de
 * OLUŞTURMAZ, yalnız Halköde'ye gider ve sonucu ekrana yazar.
 *
 * İKİ SAYFA, İKİ ANAHTAR, İKİ ORTAM:
 *   /odeme/halkode-test/<TEST_ANAHTAR>    → testapp.halkode.com.tr · para YOK
 *   /odeme/halkode-canli/<CANLI_ANAHTAR>  → app.halkode.com.tr     · GERÇEK PARA
 *
 * Hangi ortamda olunduğu ADRESTEKİ ANAHTARDAN belli olur; anahtar da çerezi
 * kurar (middleware) ve çerez client.ts cfg()'de ortamı çiviler. Yani bir
 * sayfanın yanlışlıkla öbür ortama bağlanması için anahtarın da çerezin de
 * aynı anda yanlış olması gerekir — uçlar ikisinin EŞLEŞTİĞİNİ ayrıca doğrular.
 */
import { HALKODE_TEST_ANAHTAR, HALKODE_CANLI_ANAHTAR, type HalkodeOrtam } from './preview-cookie';

export type { HalkodeOrtam };
export { HALKODE_TEST_ANAHTAR as TEST_ANAHTAR, HALKODE_CANLI_ANAHTAR as CANLI_ANAHTAR };

/**
 * Sabit deneme tutarı (TL). Halköde items toplamı ile total EŞİT olmalı
 * (yoksa status 13). CANLI sayfada da AYNI tutar — gerçek para çekileceği için
 * bilinçli olarak küçük tutuldu ve istemciden ALINMAZ.
 */
export const TEST_TUTAR_TL = 10.0;

/**
 * ÇOK KALEMLİ DEMO SEPET — sunucu sabiti, istemciden kalem ALINMAZ.
 * Neden: tek kalemli 10 TL denemesi çok kalemli akışı hiç ölçmüyordu (Yunus, 25 Eyl).
 * 25 Eyl'de 10 kez düşen `status_code=13` ("items price ... not equal to the invoice
 * total") tam da çok kalemli sepette çıkıyordu; bu sepet onun kanıt fikstürüdür:
 * adet>1 · kuruşlu fiyat · kargo kalemi · NEGATİF indirim kalemi.
 *   2 × 3,49 = 6,98 · 1 × 2,75 = 2,75 · kargo 1,50 · indirim −1,00  →  10,23 TL
 * Tutar buradan TÜRETİLİR (elle yazılmaz): sapma olursa test kırılır.
 */
export const COKLU_SEPET: ReadonlyArray<{ name: string; price: number; quantity: number }> = [
  { name: 'Demo ürün A', price: 3.49, quantity: 2 },
  { name: 'Demo ürün B', price: 2.75, quantity: 1 },
  { name: 'Kargo', price: 1.5, quantity: 1 },
  { name: 'İndirim', price: -1.0, quantity: 1 },
];
/** Kalemlerden türetilir — kuruş üzerinden toplanır ki ondalık sapma doğmasın. */
export const COKLU_TUTAR_TL =
  COKLU_SEPET.reduce((s, k) => s + Math.round(k.price * 100) * k.quantity, 0) / 100;

/** Adresteki anahtarı ortama çevirir. Tanınmayan/boş anahtar → null. */
export function anahtardanOrtam(anahtar: string | undefined): HalkodeOrtam | null {
  if (!anahtar) return null;
  // ⚠️ Boş sabitle eşleşme YASAK: HALKODE_CANLI_ANAHTAR ortamda tanımsızsa ''
  // olur ve kontrolsüz karşılaştırma boş anahtarı geçerli sayardı.
  if (HALKODE_TEST_ANAHTAR && anahtar === HALKODE_TEST_ANAHTAR) return 'test';
  if (HALKODE_CANLI_ANAHTAR && anahtar === HALKODE_CANLI_ANAHTAR) return 'canli';
  return null;
}

export function ortamAnahtari(ortam: HalkodeOrtam): string {
  return ortam === 'canli' ? HALKODE_CANLI_ANAHTAR : HALKODE_TEST_ANAHTAR;
}

export function sayfaYolu(ortam: HalkodeOrtam): string {
  return ortam === 'canli'
    ? `/odeme/halkode-canli/${HALKODE_CANLI_ANAHTAR}`
    : `/odeme/halkode-test/${HALKODE_TEST_ANAHTAR}`;
}

/** Geriye dönük ad — eski çağıranlar test yolunu bu isimle istiyordu. */
export function testYolu(): string {
  return sayfaYolu('test');
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
 *
 * ⚠️ CANLI sayfada GÖSTERİLMEZ ve çalışmaz: canlı POS test kartını tanımaz.
 */
export const TEST_KARTI = {
  no: '4155650100416111',
  sahip: 'Test Kart',
  ay: '12',
  yil: '2028',
  cvv: '555',
  not: 'QNB Finansbank test Visa — testapp POS tanımı var (1-6 taksit)',
} as const;

/**
 * 3D dönüşünde kullanıcıya gösterilecek okunur sonuç sözlüğü.
 *
 * Başarı metni ORTAMA GÖRE değişmek zorunda: test sayfasında "para çekilmedi"
 * demek doğru, canlı sayfada aynı cümle YALAN olurdu ve iade gerektiğini
 * gizlerdi. Diğer sonuçlar iki ortamda da aynı anlama geliyor.
 */
export function sonucMetni(
  ortam: HalkodeOrtam,
): Record<string, { baslik: string; aciklama: string; iyi: boolean }> {
  return {
    basarili:
      ortam === 'canli'
        ? {
            baslik: 'Ödeme başarılı — GERÇEK ÇEKİM',
            aciklama:
              'Banka 3D doğrulamasını onayladı ve Halköde işlemi "Completed" olarak döndü. ' +
              'Bu CANLI bir işlemdir: karttan 10,00 TL gerçekten çekilmiştir. ' +
              'Aşağıdaki işlem numarasını sakla — iade bu numarayla yapılır.',
            iyi: true,
          }
        : {
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
        ortam === 'canli'
          ? 'Kart doğrulandı ama banka çekimi onaylamadı (limit, kart kapalı ya da güvenlik kuralı). Para çekilmedi.'
          : 'Kart doğrulandı ama banka çekimi onaylamadı. Test ortamında bu genelde yanlış OTP ' +
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
    // ⚠️ BU METİN 17 EYL 2026'DA DEĞİŞTİRİLDİ — eskisi tehlikeliydi.
    //
    // Eski hâli: "Halköde kapalı — Önizleme çerezi düşmüş olabilir. Sayfayı linke
    // tekrar tıklayarak aç." İki ayrı şekilde yanlıştı:
    //  1) TEŞHİSİ YANLIŞ SÖYLÜYORDU. Çerez "düşmemişti"; banka dönüşü farklı bir
    //     orijine (çıplak IP, düz HTTP) düştüğü için çerez TAŞINAMIYORDU. Bu ayrım
    //     arıza avını saatlerce yanlış yöne çevirdi.
    //  2) DAHA KÖTÜSÜ: kullanıcıya "tekrar dene" diyordu. Oysa bu ekran, bankanın
    //     parayı ÇEKMİŞ olabileceği bir anda çıkıyor (biz doğrulayamadığımız için
    //     "kapalı" diyoruz). "Tekrar dene" demek ikinci bir çekim davet etmektir —
    //     canlı denemede tam olarak bu oldu.
    //
    // Yeni metnin tek işi: "başarısız" değil "DOĞRULANAMADI" demek, işlem
    // numarasını sakla dedirtmek ve tekrar denemeyi ÖNERMEMEK.
    kapali: {
      baslik: 'İşlem doğrulanamadı',
      aciklama:
        'Bankadan dönüş alındı ama işlem sunucu tarafında DOĞRULANAMADI. ' +
        'Bu "ödeme başarısız" demek DEĞİLDİR — kartınızdan çekim yapılmış olabilir. ' +
        'Lütfen TEKRAR DENEMEYİN; aşağıdaki işlem numarasını bize iletin. ' +
        'Durumu bankadan sorgulayıp çekim yapıldıysa iade ediyoruz.',
      iyi: false,
    },
  };
}

/** Geriye dönük ad — test ortamının sonuç sözlüğü. */
export const SONUC_METNI = sonucMetni('test');
