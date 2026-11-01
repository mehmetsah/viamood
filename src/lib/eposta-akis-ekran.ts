/**
 * /admin/eposta-akislari — filtre ve sorgu koşulları (#995397, Yunus 31 Eki 2026: «tutulan veriyi ve mail
 * gönderildi mi + zaman bilgisini görelim»). YALNIZ OKUMA: bu dosya ve sayfa hiçbir satır yazmaz/güncellemez/silmez.
 *
 * Akış ve durum listeleri ikinci kez yazılmaz — AKIS (eposta-akis.ts) ve DURUM (eposta-akis-kosucu.ts) tek kaynaktır;
 * geçersiz değer filtreye girmez (yok sayılır, sayfa çökmez). Tarih ayrıştırma `admin/mail-gecmisi` sayfasındaki
 * `tarih()` ile birebir aynı davranır (sayfa dosyası Next kuralı gereği yardımcı dışa aktaramıyor).
 *
 * Çivi: tests/eposta-akis-ekrani.test.ts.
 */
import { and, eq, gte, ilike, lte, type SQL } from 'drizzle-orm';
import { epostaAkisGonderimleri, epostaAkisTetikleri } from '@/db/schema/eposta-akis';
import { AKIS, type Akis } from './eposta-akis';
import { DURUM } from './eposta-akis-kosucu';

export const PAGE_SIZE = 30;
export const AKISLAR = Object.values(AKIS) as Akis[];
export const DURUMLAR = Object.values(DURUM) as string[];

export const AKIS_ETIKET: Record<string, string> = {
  [AKIS.HOS_GELDIN]: 'Hoş geldin',
  [AKIS.SEPET_TERKI]: 'Sepet terki',
  [AKIS.CHECKOUT_TERKI]: 'Checkout terki',
};
export const DURUM_ETIKET: Record<string, string> = {
  [DURUM.PLANLANDI]: 'planlandı',
  [DURUM.ISLENIYOR]: 'işleniyor',
  [DURUM.GONDERILDI]: 'gönderildi',
  [DURUM.ATLANDI]: 'atlandı',
  [DURUM.IPTAL]: 'iptal',
  [DURUM.HATA]: 'hata',
};

/** Erken kapanış sebebi (şema: eposta_akis_tetikleri.iptal_sebebi). Bilinmeyen değer HAM hâliyle gösterilir. */
export const IPTAL_ETIKET: Record<string, string> = {
  donusum: 'dönüşüm (sipariş verdi)',
  abonelik_iptal: 'abonelikten çıktı',
  elle: 'elle kapatıldı',
};

export type AramaParametreleri = { akis?: string; durum?: string; email?: string; bas?: string; son?: string; page?: string; tpage?: string };
export type Filtre = { akis?: Akis; durum?: string; email?: string; bas: Date | null; son: Date | null };

/** `YYYY-MM-DD` → Date. Geçersizse null (filtre yok sayılır, sayfa çökmez) — mail-gecmisi ile aynı. */
export function tarih(v: string | undefined, gunSonu = false): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + (gunSonu ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function filtreCoz(sp: AramaParametreleri): Filtre {
  const email = sp.email?.trim();
  return {
    akis: sp.akis && (AKISLAR as string[]).includes(sp.akis) ? (sp.akis as Akis) : undefined,
    durum: sp.durum && DURUMLAR.includes(sp.durum) ? sp.durum : undefined,
    email: email ? email : undefined,
    bas: tarih(sp.bas),
    son: tarih(sp.son, true),
  };
}

/** Tetik tablosunun koşulu: akış · e-posta (ilike) · tetik anı aralığı. */
export function tetikKosulu(f: Filtre): SQL | undefined {
  const k: SQL[] = [];
  if (f.akis) k.push(eq(epostaAkisTetikleri.akis, f.akis));
  if (f.email) k.push(ilike(epostaAkisTetikleri.email, `%${f.email}%`));
  if (f.bas) k.push(gte(epostaAkisTetikleri.tetikAni, f.bas));
  if (f.son) k.push(lte(epostaAkisTetikleri.tetikAni, f.son));
  return k.length ? and(...k) : undefined;
}

/** Gönderim tablosunun koşulu: tetik koşulu (join üzerinden) + gönderim durumu. */
export function gonderimKosulu(f: Filtre): SQL | undefined {
  const t = tetikKosulu(f);
  const k = [t, f.durum ? eq(epostaAkisGonderimleri.durum, f.durum) : undefined].filter((x): x is SQL => !!x);
  return k.length ? and(...k) : undefined;
}

/** Bilinmeyen zaman «—» olarak gösterilir; null asla 0/epoch (1970) gibi sunulmaz (md.52). */
export function zamanGoster(d: Date | string | null | undefined): string {
  if (d === null || d === undefined || d === '') return '—';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleString('tr-TR');
}
