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
