/**
 * #994831 · DALGA 7 · EKSEN KAPISI ÇİVİSİ — ölçülmüş yanlış eşleşmeler REDDEDİLİR, doğru örnekler GEÇER.
 * MUTASYON: dışlama listesinden bir sözcük çıkarılırsa ilgili negatif iddia KIRILIR.
 */
import { describe, expect, it } from 'vitest';
import { cevapUygunMu } from '../src/lib/sss-eksen';

const RED: Array<[string, string, string]> = [
  ['Kapasitesi nedir?', 'Yaklaşık 1 litre sıcak su hazırlayın.', 'talimat (hazırla)'],
  ['Kapasitesi nedir?', 'Deterjan kullanımı: Otomatik dozaj sistemi ile yıkama suyuna 1–3 mL/L oranında dozajlayınız.', 'dozaj · mL/L'],
  ['Kapasitesi nedir?', 'Durulama suyuna 0,2–0,5 ml/l ölçüsünde ekleyiniz, 2 litre kova kullanın.', 'mL/L'],
  ['Pakette neler var?', 'Bu üründen en fazla 10 adet sipariş verilebilir.', 'sipariş parçası'],
  ['Pakette neler var?', '2 adet saklama kabı tek siparişle sunulur.', 'sipariş (yalıtılmış: paket şartını geçer)'],
  ['Pakette neler var?', '25 adet suya dayanıklı etiket hediyedir.', 'hediye'],
  ['Bakımı nasıl yapılır?', '25 adet Suya Dayanıklı Yıkanabilir Etiket — HEDİYE', 'etiket/hediye'],
  ['Bakımı nasıl yapılır?', 'Kahve yağlarının temizlenmesine yardımcı olur', 'ürünün işlevi'],
  ['Güvenlik uyarısı var mı?', 'Ürünü kullanmadan önce ambalaj üzerindeki kullanım talimatlarını ve güvenlik uyarılarını mutlaka okuyunuz.', 'yönlendirme'],
  ['Malzemesi nedir?', 'Paslanmaz çelik yüzeylerde kullanım – Profesyonel mutfakların metal yüzeylerinin temizliğine yardımcı olur', 'yüzey'],
  ['Malzemesi nedir?', 'Paslanmaz çelik yüzeylerde güvenle kullanılan malzemedir.', 'yüzey (yalıtılmış)'],
  ['Malzemesi nedir?', 'Metal kilit sistemi ile güvenli taşıma', 'kilit'],
  ['Malzemesi nedir?', 'Kumaş dövüş kıyafeti (gi) ve ikonik kırmızı bandana detayı', 'kıyafet/detay'],
  ['Ölçüleri nedir?', 'S Ölçüleri: 7,5x7,5x5,5cm', 'set parçası'],
  ['Ölçüleri nedir?', '4 Adet 10,5x10,5cm Küçük yuvarlak sosluk', 'set parçası'],
  ['Nerede kullanılır?', 'Güçlendirilmiş dikiş yapısı sayesinde yoğun kullanıma uygundur.', 'yer/ortam yok'],
  ['Kaç yaş için uygun?', '18 yaş altına satış yapılmaz.', 'satış kuralı'],
  ['Nasıl kullanılır?', 'Ürünü kullanmadan önce çalkalayınız.', 'uygulanmayan eksen'],
  ['Hangi seri / koleksiyon?', 'Jurassic World koleksiyonlarına katılıyor.', 'uygulanmayan eksen'],
  ['Pakette neler var?', 'Kargo ile 1 adet paket gönderilir.', 'kargo'],
];
const GEC: Array<[string, string]> = [
  ['Kapasitesi nedir?', '750 ml ambalajıyla hem günlük hem de profesyonel kullanıma uygundur.'],
  ['Pakette neler var?', '2 adet araç: Stroll (18) ve Alonso (14)'],
  ['Pakette neler var?', 'Paket içerisinde 1 adet Therizinosaurus figürü bulunur'],
  ['Malzemesi nedir?', '%100 Orijinal Solingen – Made in Germany: 18/0 paslanmaz Alman çeliği'],
  ['Malzemesi nedir?', 'Kumaş: %100 Pamuk'],
  ['Ölçüleri nedir?', 'Boyut: 13,5 x 8,5 cm'],
  ['Bakımı nasıl yapılır?', 'Bulaşık makinesinde yıkanabilir (uzun ömür için elde yıkama önerilir)'],
  ['Gıda ile temasa uygun mu?', 'Gıda ile temasa uygundur ve güvenle kullanılabilir.'],
  ['Güvenlik uyarısı var mı?', 'Yutulması halinde tıbbi yardım alınız.'],
  ['Nerede kullanılır?', 'Mutfak, banyo, ofis, salon veya yatak odasında kullanılabilir.'],
];

describe('eksen kapısı', () => {
  for (const [soru, cevap, neden] of RED) it(`RED · ${soru} · ${neden}`, () => { expect(cevapUygunMu(soru, cevap).ok).toBe(false); });
  for (const [soru, cevap] of GEC) it(`GEÇER · ${soru} · ${cevap.slice(0, 40)}`, () => { expect(cevapUygunMu(soru, cevap)).toEqual({ ok: true }); });
});
