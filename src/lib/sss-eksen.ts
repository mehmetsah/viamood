/**
 * #994831 · SSS DALGA 7 · SORU EKSENLERİ KAPISI.
 *
 * Dalga 7'nin SSS çiftleri ürün açıklamasından BİREBİR alıntıdır (cümle ya da madde / «Anahtar: değer» parçası).
 * Bu modül bir çiftin SORUSUNU gerçekten cevaplayıp cevaplamadığını ölçer: her eksenin bir ŞARTI (cevapta
 * bulunması gereken kalıp) ve bir DIŞLAMA listesi (aynı sözcüğü başka anlamda taşıyan, ölçülmüş yanlış
 * eşleşmeler) var. Dışlama listeleri 31 Eki 2026 teşhisinde (raporlar/994831-dalga6) ve dalga 7 gözden
 * geçirmesinde ELLE görülen yanlış çiftlerden türedi:
 *   Kapasite: «Yaklaşık 1 litre sıcak su hazırlayın.» · «1–3 mL/L oranında dozajlayınız.» (talimat, kapasite değil)
 *   Paket: «Bu üründen en fazla 10 adet sipariş verilebilir.» (satış kuralı) · «… Seti ile … sağlayın» (pazarlama)
 *   Bakım: «25 adet Suya Dayanıklı Yıkanabilir Etiket — HEDİYE» · «Kahve yağlarının temizlenmesine yardımcı olur»
 *   Güvenlik: «… kullanım talimatlarını ve güvenlik uyarılarını okuyunuz» (yönlendirme, uyarının kendisi değil)
 *   Malzeme: «Paslanmaz çelik yüzeylerde kullanım» · «Metal kilit sistemi …» · «Kumaş dövüş kıyafeti … detayı»
 *   Nerede: yer/ortam sözcüğü olmayan «yoğun kullanıma uygundur» türü cümleler
 * Uygulanmayan eksenler (ölçülen isabet düşük, Mehmet kararı): «Nasıl kullanılır?» · «Lisans/seri» · «Güç/şarj».
 *
 * Çivi: tests/damgali-kur.test.ts (dalga 7 verisi) + tests/sss-eksen.test.ts.
 */
export const kucuk = (s: string) => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr');

/** Hiçbir eksende cevapta geçemez (kargo/iade çelişkisi #994995 · satış/fiyat · doğrulanmamış bilgi). */
export const GENEL_YASAK = /kargo|teslimat|iade|stok|sipariş|garanti|fiyat|indirim|kampanya|ücretsiz|doğrula|teyit|\?/;

const MALZ = '(pamuk|bambu|polyester|poliamid|elastan|modal|akrilik|viskon|plastik|polipropilen|\\bpp\\d?\\b|\\babs\\b|ahşap|metal(?!ik)|paslanmaz|çelik|alüminyum|silikon|\\bcam\\b|seramik|porselen|peluş|kumaş|\\bderi\\b|bakır|döküm|granit|tritan|melamin|die-cast|polirezin|vinil|pvc|karton)';

export type Eksen = { sart: RegExp; dislama: RegExp };
export const EKSENLER: Record<string, Eksen> = {
  'Malzemesi nedir?': {
    sart: new RegExp(`(?=.*${MALZ}).*(üretil|yapılmış|imal edil|malzeme|içeriğe sahip|içerikli|gövde|yapısı|şasi|çeliği|kumaş)|^(malzeme|materyal|gövde malzemesi|malzeme içeriği|ürün malzemesi|içerik|kumaş)\\s*:`),
    dislama: /doku|desen|görünüm|renk|temizle|yüzey|kilit|sistem|detay|kıyafet/,
  },
  'Ölçüleri nedir?': {
    sart: /(ölçü|boyut|ebat|yükseklik|genişlik|uzunluk|çap)\w*.{0,40}\d+(?:[.,]\d+)?\s?(cm|mm|ml|lt|litre|kg|gr)\b|\d+(?:[.,]\d+)?\s?cm.lik|\d+(?:[.,]\d+)?\s?x\s?\d+(?:[.,]\d+)?\s?(x\s?\d+(?:[.,]\d+)?\s?)?(cm|mm)\b/,
    dislama: /hazırla|dozaj|oranında|ekleyin|uygulay|gönderil|paket içeri|(cm|mm)\s+[a-zçğıöşü]+$|^\d+\s?adet|^(xs|s|m|l|xl|xxl) ölçü/,
  },
  'Kapasitesi nedir?': {
    sart: /(kapasite|hacm)\w*.{0,40}\d|\d+(?:[.,]\d+)?\s?(lt|litre|ml)\b/,
    dislama: /hazırla|ml\/l|dozaj|oranında|ekleyin|uygulay|seyrelt/,
  },
  'Pakette neler var?': {
    sart: /^(paket|set|kutu) ?(içeriği|içerik)\s*:|^\d+\s?(adet|parça|çift)\b|(paket|set|kutu)\w* içeri(sinde|ğinde).*\d+\s?(adet|parça|çift)|(pakette|sette|kutuda).*\d+\s?(adet|parça|çift)/,
    dislama: /sipariş|sağlayın|getirin|gönderil|hediye/,
  },
  'Bulaşık makinesinde yıkanabilir mi?': { sart: /bulaşık makinesinde/, dislama: /yüzey|etiket/ },
  'Nasıl yıkanmalı?': { sart: /elde yıka|°c.{0,4}de yıka|yıkanması (tavsiye|öneril)/, dislama: /etiket/ },
  'Temizliği kolay mı?': { sart: /kolay(ca)? temizlen/, dislama: /leke|kir\b/ },
  'Bakımı nasıl yapılır?': {
    sart: /yıkan|yıkay|temizlen|silin|silerek/,
    dislama: /temizleyici|temizlik|temizlenmesine|temizliğine|yardımcı olur|etiket|hediye|temizlenecek|solüsyon/,
  },
  'Gıda ile temasa uygun mu?': { sart: /\bbpa\b|gıda ile temas|gıdayla temas|gıdaya uygun|gıda güvenliğ/, dislama: /(?!)/ },
  'Kaç yaş için uygun?': { sart: /\d+\s?(\+|yaş)/, dislama: /satış/ },
  'Güvenlik uyarısı var mı?': { sart: /çocukların erişemeyeceği|yutul|boğulma|uyarı/, dislama: /talimatlarını|uyarılarını/ },
  'Nerede kullanılır?': {
    sart: /(?=.*(kullanılabilir|kullanıma uygun|uygundur|idealdir|tercih edilebilir)).*\b(ev|evde|mutfak|banyo|ofis|atölye|oyun|koleksiyon|dış mekan|iç mekan|buzdolab|dolap|tezgah|salon|balkon|yatak odası|gezi|piknik|kamp|profesyonel|günlük|okul|araç|giyim|kombin|alanlar|alanlarda|ortam|yüzey|makine)/,
    dislama: /yaş|gıda|bpa|bulaşık|yıka|temizlen|mikrodalga|dondurucu/,
  },
};

/** Dalga 7'de UYGULANMAYAN eksenler — bu sorular veride geçemez. */
export const UYGULANMAYAN = ['Nasıl kullanılır?', 'Lisanslı / orijinal mi?', 'Hangi seri / koleksiyon?', 'Güç / pil / şarj?'];

export function cevapUygunMu(soru: string, cevap: string): { ok: boolean; sebep?: string } {
  const e = EKSENLER[soru];
  if (!e) return { ok: false, sebep: `bilinmeyen ya da uygulanmayan eksen: ${soru}` };
  const c = kucuk(cevap);
  if (GENEL_YASAK.test(c)) return { ok: false, sebep: 'genel yasak sözcük' };
  if (!e.sart.test(c)) return { ok: false, sebep: 'cevap soruyu karşılamıyor (şart)' };
  if (e.dislama.test(c)) return { ok: false, sebep: 'ölçülmüş yanlış eşleşme kalıbı (dışlama)' };
  return { ok: true };
}
