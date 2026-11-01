/**
 * #994831 · yer tutucu süzgecinin ORTAK örnekleri — SSS çivisi (tests/sss-yer-tutucu.test.ts) ve açıklama çivisi
 * (tests/aciklama-yer-tutucu.test.ts) aynı listeyi kullanır; iki kopya ayrışmasın diye tek dosya.
 */
/** Meşru zor örnekler (canlı DB'den birebir + sınır vakaları) — yanlış alarm 0 olmalı. */
export const MESRU = [
  'Yıkama: Önerisi 30°C.', // yalın «önerisi» desen DEĞİL (canlı, pola bambu çorap)
  '50 ml ürünü 1 litre temiz ve oda sıcaklığındaki suya ekleyin. Kahve makinenizin kullanım kılavuzunda süt sistemi için özel bir temizlik işlemi belirtilmemişse hazırlanan solüsyonu makineye çektirin. Temizlik tamamlandıktan sonra sistemi temiz suyla iyice durulayın.',
  'Ürünümüz yüksek performanslı sert (5 numaralı) PP plastikten üretilmiştir.',
  'Kirli sepeti 55 litre (46 × 34,5 × 58 cm), çok amaçlı sepet 35 litre (54 × 33,5 × 26 cm).',
  'Bakım: (bakım talimatı kutudadır) nemli bezle silinir.', // «bak» `\b` ile «bakım»da eşleşirdi
  'Bedenler XS, S, M, L, XL, XXL ve XXXL.', // beden kodu şablon değil
  'Teknik bilgiler, ürün kodu ve ölçüler Via Mood ürün sayfasından doğrulanmıştır.', // geçmiş zaman beyan
  'Kullanmadan önce parçaları kontrol edin.', // müşteriye talimat, editör emri değil
  'Gözlük 1:64 ölçekli; kutu içeriği (1 adet) görseldeki gibidir.',
  'Yaş: 13+.',
];
