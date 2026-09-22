/**
 * İlçe, kayıtlı ilin ilçe listesinde mi? — kargo etiketi kesilmeden önceki son kapı.
 *
 * Neden (#1164 / #1169): Shopify ili posta kodundan yeniden yazdığında sipariş
 * "Ankara / Erbaa" gibi imkânsız bir çiftle kaydediliyor ve etiket yanlış ile
 * kesiliyordu. Vitrin formu il ve ilçeyi BU dosyanın okuduğu `tr-il-ilce.json`
 * listesinden seçtiriyor (canlı tema asset'i ile birebir aynı — 21 Eyl ölçüldü:
 * 81 il / 973 ilçe, 0 fark), yani formdan gelen doğru bir çift bu kapıya takılmaz;
 * takılan çift, form SONRASI bir yerde bozulmuştur.
 *
 * Karşılaştırma Türkçe harf farklarına dayanıklı: tek bir yerel (tr / en) seçmek
 * seçilmeyen dili sessizce eler (CLAUDE.md §3c, 9. madde). Bu yüzden İ, I ve ı
 * AÇIKÇA 'i'ye indirilir, sonra diakritikler (ç ğ ö ş ü â î û) sökülür.
 *   'İstanbul' = 'ISTANBUL' = 'istanbul' = 'Istanbul' (Shopify'ın yazımı)
 *   'Şişli' = 'şişli' = 'SISLI' · 'Iğdır' = 'IĞDIR' = 'igdir'
 */
import data from './tr-il-ilce.json';

interface IlKaydi {
  ad: string;
  ilceler: string[];
}

const ILLER = (data as unknown as { iller: Record<string, IlKaydi> }).iller;

/** Türkçe/İngilizce büyük-küçük harf ve aksandan bağımsız karşılaştırma anahtarı. */
export function trKatla(deger: string | null | undefined): string {
  return (deger ?? '')
    .trim()
    .replace(/[İIı]/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-_.'’]+/g, '');
}

/** Resmî adı listede olmayan yaygın il yazımları (plaka kodu). */
const IL_TAKMA_AD: Record<string, string> = {
  afyon: '03',
  icel: '33',
  maras: '46',
  urfa: '63',
  antep: '27',
};

let IL_HARITASI: Map<string, string> | null = null;
function ilHaritasi(): Map<string, string> {
  if (IL_HARITASI) return IL_HARITASI;
  const m = new Map<string, string>();
  for (const [kod, rec] of Object.entries(ILLER)) m.set(trKatla(rec.ad), kod);
  for (const [ad, kod] of Object.entries(IL_TAKMA_AD)) if (!m.has(ad)) m.set(ad, kod);
  IL_HARITASI = m;
  return m;
}

/** İl adı ya da 'TR-XX' → plaka kodu ('60'); tanınmazsa null. */
export function ilPlakasi(il: string | null | undefined): string | null {
  const k = trKatla(il);
  if (!k) return null;
  const kodMu = /^tr(\d{2})$/.exec(k);
  if (kodMu) {
    const plaka = kodMu[1] ?? '';
    return ILLER[plaka] ? plaka : null;
  }
  return ilHaritasi().get(k) ?? null;
}

export type IlIlceUyum =
  | { durum: 'uyumlu'; il: string; ilce: string }
  | { durum: 'uyumsuz'; il: string; ilce: string }
  | { durum: 'dogrulanamadi'; sebep: 'il-yok' | 'il-tanimsiz' | 'ilce-yok' };

/**
 * İlçe, ilin ilçe listesinde mi?
 *
 * - 'uyumlu'        → etiket kesilebilir
 * - 'uyumsuz'       → ilçe bu ilin listesinde YOK — etiket KESİLMEMELİ
 * - 'dogrulanamadi' → il boş ya da tanınmıyor: bugünkü davranış sürer (etiket kesilir).
 *   Ölçüm (21 Eyl, son 60 gün): etiketi kesilmiş 108 siparişin 51'inde Shopify'da il
 *   BOŞ (eski PayTR siparişleri). Bunları durdurmak doğru etiketleri durdurmak olurdu.
 *
 * "Merkez": ilçe listesinde "Merkez" olan illerde müşteri merkez ilçeyi "Merkez",
 * il adının kendisi ya da "<İl> Merkez" diye yazabilir — üçü de uyumlu sayılır.
 */
export function ilIlceUyumu(il: string | null | undefined, ilce: string | null | undefined): IlIlceUyum {
  const ilHam = (il ?? '').trim();
  const ilceHam = (ilce ?? '').trim();
  if (!ilHam) return { durum: 'dogrulanamadi', sebep: 'il-yok' };
  if (!ilceHam) return { durum: 'dogrulanamadi', sebep: 'ilce-yok' };
  const plaka = ilPlakasi(ilHam);
  const kayit = plaka ? ILLER[plaka] : undefined;
  if (!kayit) return { durum: 'dogrulanamadi', sebep: 'il-tanimsiz' };

  const aranan = trKatla(ilceHam);
  const liste = new Set(kayit.ilceler.map(trKatla));
  if (liste.has(aranan)) return { durum: 'uyumlu', il: ilHam, ilce: ilceHam };
  if (liste.has('merkez')) {
    const ilAnahtar = trKatla(kayit.ad);
    if (aranan === ilAnahtar || aranan === ilAnahtar + 'merkez' || aranan === 'merkez' + ilAnahtar) {
      return { durum: 'uyumlu', il: ilHam, ilce: ilceHam };
    }
  }
  return { durum: 'uyumsuz', il: ilHam, ilce: ilceHam };
}
