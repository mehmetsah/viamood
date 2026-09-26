/**
 * KALEM TOPLAMI ↔ FATURA TOPLAMI HİZALAMA — SAF mantık, bağımlılığı yok.
 *
 * NEDEN AYRI DOSYA (26 Eyl 2026, Elif · #991458b · Okan'dan devredilen MUT-E maddesi):
 * Bu kapı `initialize/route.ts` içinde gömülüydü ve **bekçisizdi**. Okan'ın denetim
 * mutasyonu (`sapmaKurus = 0`) çiviyi kırmadı; sebebi ölçüldü ve matematikseldir:
 *
 *   itemsKurus       = Σ Math.round(li.price) × qty
 *   items[i].price   = Math.round(li.price) / 100
 *   itemsToplamKurus = Σ Math.round(price × 100) × qty  =  Σ Math.round(li.price) × qty
 *
 * İki taraf AYNI yuvarlamayı kullandığı için sapma bugünkü girdi uzayında
 * **doğamıyor** (ölçüldü: 6 senaryo, sapma doğan senaryo sayısı 0 — üç ondalıklı
 * birim fiyat, 1/3 kuruş, 11111.111 dâhil). Yani "sapmalı girdi bul" yolu kapalı:
 * kapı, ÜRÜN KODU YOLUYLA tetiklenemediği için çivilenemiyordu.
 *
 * Çözüm kapıyı zayıflatmak DEĞİL, ÖLÇÜLEBİLİR kılmak: mantık saf bir fonksiyona
 * çıkarıldı ve doğrudan sapmalı `items` verilerek sınanıyor. Kapı hâlâ aynı işi
 * yapıyor — bugün boşta duran ama `li.price` ondalıklı kuruş taşımaya başladığı
 * ya da fiyat kaynağı değiştiği gün TEK koruma olan savunma katmanı.
 *
 * Neden önemli: kalem toplamı fatura toplamına eşit değilse Halköde
 * `status_code=13` döndürür ("items price ... not equal to the invoice total")
 * ve ödeme REDDEDİLİR — 25 Eyl'de 10 kez yaşandı.
 */
export type HizaKalem = { name: string; price: number; quantity: number };

export type HizaSonuc = {
  /** Sapma kapatıldıktan sonraki kalemler (girdi DİZİSİ değiştirilmez). */
  items: HizaKalem[];
  /** Kapatılan sapma, kuruş. 0 = kapı boşta kaldı. */
  sapmaKurus: number;
  /** Kapı gerçekten çalıştı mı — gözlenebilir çıktı, log'a bağlı değil. */
  duzeltildi: boolean;
};

/** Kalemlerin Halköde'ye göre toplamı (o da `price × quantity` hesaplar), kuruş. */
export function kalemToplamiKurus(items: ReadonlyArray<HizaKalem>): number {
  return items.reduce((s, it) => s + Math.round(it.price * 100) * it.quantity, 0);
}

/**
 * Kalem toplamını fatura toplamına KURUŞU KURUŞUNA oturtur.
 *
 * Sapma son kaleme yazılır: fatura toplamı müşterinin gördüğü tutardır ve
 * DEĞİŞTİRİLEMEZ; oynayabileceğimiz tek yer kalem kırılımıdır.
 */
export function kalemleriHizala(
  items: ReadonlyArray<HizaKalem>,
  toplamKurus: number,
): HizaSonuc {
  const kopya = items.map((i) => ({ ...i }));
  const sapmaKurus = Math.round(toplamKurus) - kalemToplamiKurus(kopya);
  if (sapmaKurus === 0) return { items: kopya, sapmaKurus, duzeltildi: false };

  const son = kopya.at(-1);
  // ⚠ ÖLÇÜLEN KUSUR (26 Eyl 2026, #991458b): eski hâl sapmayı KOŞULSUZ son kalemin
  // BİRİM fiyatına `sapma / quantity` olarak yazıyordu. Adet>1 ve sapma adete tam
  // bölünmüyorsa bu HİÇBİR ŞEY yapmıyor: 3,33 × 3 = 999 kuruş, fatura 1000 →
  // sapma 1 → 1/3 = 0,333 → round(333,333)/100 = 3,33, yani fiyat AYNI kalıyor ve
  // toplam 999'da duruyor. Kapı "düzeltti" sanılıyor, Halköde status_code=13 dönüyor.
  // Doğrusu: sapma ancak adete TAM bölünüyorsa birim fiyata yazılabilir.
  if (son && son.quantity > 0 && sapmaKurus % son.quantity === 0) {
    son.price = Math.round(son.price * 100 + sapmaKurus / son.quantity) / 100;
    return { items: kopya, sapmaKurus, duzeltildi: true };
  }

  // Bölünemeyen sapma adet=1'lik AYRI kalemle kapatılır. Mevcut satırlara
  // dokunulmaz — müşterinin gördüğü kalem fiyatları oynamaz — ve toplam kuruşu
  // kuruşuna oturur. Kargo/İndirim de zaten aynı biçimde eklenen kalemlerdir.
  kopya.push({ name: 'Kuruş düzeltme', price: Math.round(sapmaKurus) / 100, quantity: 1 });
  return { items: kopya, sapmaKurus, duzeltildi: true };
}
