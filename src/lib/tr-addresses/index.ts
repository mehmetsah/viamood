/**
 * TR il/ilçe veri seti + yardımcılar.
 *
 * Şu an 81 il + major ilçeler. Mahalle dataset'i 50k+ kayıt olduğu için
 * runtime'da (storefront) datalist ile veya 3rd-party API ile yüklenir.
 *
 * Veri kaynağı: ./tr-il-ilce.json
 */
import data from './tr-il-ilce.json';

interface IlRecord {
  ad: string;
  ilceler: string[];
}

interface TrAddressData {
  iller: Record<string, IlRecord>;
}

const TYPED = data as unknown as TrAddressData;

export const ILLER: ReadonlyArray<{ kod: string; ad: string }> = Object.entries(TYPED.iller)
  .map(([kod, rec]) => ({ kod, ad: rec.ad }))
  .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

export function getIlceler(ilAdi: string): string[] {
  for (const [, rec] of Object.entries(TYPED.iller)) {
    if (rec.ad.localeCompare(ilAdi, 'tr', { sensitivity: 'base' }) === 0) {
      return rec.ilceler.slice().sort((a, b) => a.localeCompare(b, 'tr'));
    }
  }
  return [];
}

export function isValidIl(name: string): boolean {
  return ILLER.some((i) => i.ad.localeCompare(name, 'tr', { sensitivity: 'base' }) === 0);
}

export function normalizeIl(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  for (const il of ILLER) {
    if (il.ad.localeCompare(trimmed, 'tr', { sensitivity: 'base' }) === 0) {
      return il.ad;
    }
  }
  // Yaygın kısaltma/yanlış yazımları yakala
  const lc = trimmed.toLocaleLowerCase('tr-TR');
  const aliases: Record<string, string> = {
    ist: 'İstanbul',
    istanbul: 'İstanbul',
    ank: 'Ankara',
    ankara: 'Ankara',
    izmir: 'İzmir',
    bursa: 'Bursa',
    antalya: 'Antalya',
    adana: 'Adana',
    konya: 'Konya',
    gaziantep: 'Gaziantep',
    'gazi antep': 'Gaziantep',
    şanlıurfa: 'Şanlıurfa',
    sanliurfa: 'Şanlıurfa',
    urfa: 'Şanlıurfa',
    kahramanmaraş: 'Kahramanmaraş',
    maraş: 'Kahramanmaraş',
  };
  return aliases[lc] ?? null;
}

// ============================================================================
// İLÇE → İL ters araması (#1519 / #615 / #631)
// ============================================================================
/**
 * Neden: Shopify'ın native TR adres formunda İL alanı yok, bu yüzden
 * `cart/service.ts` Shopify'a `province: ''` yazıyordu. Ölçüm: son 30 günde
 * 57 siparişin 25'inde (%44) il boş, ilçe ise HER ZAMAN dolu. Dolayısıyla il,
 * ilçeden türetilebilir.
 *
 * `localeCompare(..., {sensitivity:'base'})` burada yetmez: 973 ilçeyi her
 * çağrıda taramak O(n) ve "kadikoy" gibi ASCII yazımları güvenilir eşleşmez.
 * Bu yüzden normalize edilmiş anahtarla tek seferlik Map kuruluyor.
 */
function normalizeAd(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    // Türkçe harfleri ASCII'ye indir. NFD + diakritik silme 'ı' ve 'İ'yi
    // doğru çözmediği için eşleme AÇIK yazıldı.
    .replace(/[ıİi̇]/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    // "Şehit Kamil" / "şehitkamil" / "Şehit-Kamil" aynı anahtara düşsün
    .replace(/[\s\-_.]+/g, '');
}

/** Normalize ilçe adı → il adı. Tek seferlik kurulur (973 kayıt). */
let ILCE_IL_HARITASI: Map<string, string> | null = null;

function ilceHaritasi(): Map<string, string> {
  if (ILCE_IL_HARITASI) return ILCE_IL_HARITASI;
  const m = new Map<string, string>();
  for (const rec of Object.values(TYPED.iller)) {
    for (const ilce of rec.ilceler) {
      const anahtar = normalizeAd(ilce);
      // İLK KAZANIR: aynı ilçe adı birden fazla ilde geçebilir (ör. Merkez,
      // Çay, Gölbaşı). Böyle bir çakışmada tahmin yürütmek yanlış il yazmak
      // demektir; ama ilk kaydı tutmak hiç yazmamaktan iyidir ve mevcut
      // davranışı (boş) bozmaz.
      if (!m.has(anahtar)) m.set(anahtar, rec.ad);
    }
  }
  ILCE_IL_HARITASI = m;
  return m;
}

/**
 * İlçe adından il adını bulur. Bulunamazsa null döner — ÇAĞIRAN TARAF
 * boş bırakmaya devam etmeli, uydurma il yazmamalı.
 */
export function ilceIlBul(ilceAdi: string | null | undefined): string | null {
  if (!ilceAdi) return null;
  const anahtar = normalizeAd(ilceAdi);
  if (!anahtar) return null;
  return ilceHaritasi().get(anahtar) ?? null;
}
