/**
 * #994831 · ÜRÜN SSS TOPLU İÇE AKTARMA — saf çekirdek (DB/Shopify bağımlılığı dışarıdan verilir).
 *
 * ÖLÇÜLEN DURUM (23 Eki 2026, Elif): Shopify'da 450 ACTIVE ürün, SSS'i dolu olan 1
 * (`urun_sss` 1 satır · `custom.sss` metafield'ı 1 ürün). Tek yazma yolu admin ekranıydı
 * (ürün başına elle, oturumlu server action) — 441 ürün için kullanılamaz.
 *
 * KURALLAR (görev şartları):
 *  (a) girdi JSONL — her satır bir ürün: {"handle": "...", "sss": [{"soru": "...", "cevap": "..."}]}
 *  (b) VARSAYILAN DRY-RUN — `uygula: true` verilmeden `yaz`/`senkronla` HİÇ çağrılmaz
 *  (c) idempotent — üründe aynı küme zaten varsa yazılmaz ("zaten-yazili")
 *  (d) eksik/boş alan reddedilir (handle, sss listesi, soru, cevap — `sssDogrula` ile aynı kurallar)
 *  (e) her satır kütüğe düşer (handle · sonuç · sebep · kip)
 * Ek güvenlik: üründe FARKLI bir SSS zaten varsa EZİLMEZ ("mevcut-sss-var") — elle yazılmış
 * içerik toplu betikle kaybolmasın. Ürün başına en çok SSS_URUN_BASI_EN_COK soru.
 * Hatalı handle / Shopify'da olmayan ürün süreci DURDURMAZ — o satır reddedilir, sıradakine geçilir.
 */
import { handleTemizle, sssDogrula, type SssKayit } from './urun-sss';

export const SSS_URUN_BASI_EN_COK = 4;

export type IceAktarSonuc =
  | 'dry-run-yazilacak'
  | 'yazildi'
  | 'yazildi-senkron-hatasi'
  | 'zaten-yazili'
  | 'mevcut-sss-var'
  | 'urun-yok'
  | 'reddedildi'
  | 'hata';

export interface KutukSatiri {
  satir: number;
  handle: string;
  sonuc: IceAktarSonuc;
  sebep: string;
  kip: 'dry-run' | 'uygula';
  soruSayisi: number;
}

export interface IceAktarBagimliliklari {
  /** Ürünün DB'deki mevcut SSS kayıtları (açık/kapalı hepsi). */
  mevcutOku: (handle: string) => Promise<Array<{ soru: string; cevap: string }>>;
  /** Shopify'da bu handle'lı ürün var mı. */
  urunVarMi: (handle: string) => Promise<boolean>;
  /** Kayıtları DB'ye yazar (yalnız uygula kipinde çağrılır). */
  yaz: (handle: string, kayitlar: SssKayit[]) => Promise<void>;
  /** Metafield'ı tazeler (yalnız uygula kipinde, yazımdan SONRA çağrılır). */
  senkronla: (handle: string, kayitlar: SssKayit[]) => Promise<{ ok: boolean; hata?: string }>;
  /** Kütüğe bir satır ekler. */
  kutuk: (s: KutukSatiri) => void | Promise<void>;
}

export interface Ayristirilmis {
  handle: string;
  kayitlar: SssKayit[];
}

/** Tek JSONL satırını doğrular. Hata varsa sebebiyle `{hata}` döner — hiçbir yan etki yok. */
export function satirAyristir(ham: string): Ayristirilmis | { hata: string; handle: string } {
  let o: unknown;
  try {
    o = JSON.parse(ham);
  } catch {
    return { hata: 'geçersiz JSON', handle: '' };
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { hata: 'satır bir nesne değil', handle: '' };
  const r = o as Record<string, unknown>;
  const handleHam = typeof r.handle === 'string' ? r.handle : '';
  const handle = handleTemizle(handleHam);
  if (!handle) return { hata: 'handle eksik ya da geçersiz', handle: handleHam };
  if (handle !== handleHam.trim().toLowerCase()) {
    return { hata: `handle biçimi beklenmedik ("${handleHam}") — yalnız a-z 0-9 - kabul edilir`, handle };
  }
  if (!Array.isArray(r.sss) || r.sss.length === 0) return { hata: 'sss listesi eksik ya da boş', handle };
  if (r.sss.length > SSS_URUN_BASI_EN_COK) {
    return { hata: `ürün başına en çok ${SSS_URUN_BASI_EN_COK} soru (${r.sss.length} geldi)`, handle };
  }
  const kayitlar: SssKayit[] = [];
  const gorulen = new Set<string>();
  for (let i = 0; i < r.sss.length; i++) {
    const g = r.sss[i] as { soru?: unknown; cevap?: unknown } | null;
    const d = sssDogrula({ soru: typeof g?.soru === 'string' ? g.soru : '', cevap: typeof g?.cevap === 'string' ? g.cevap : '', sira: i });
    if ('hata' in d) return { hata: `${i + 1}. soru: ${d.hata}`, handle };
    const anahtar = d.kayit.soru.toLocaleLowerCase('tr');
    if (gorulen.has(anahtar)) return { hata: `${i + 1}. soru tekrar ediyor`, handle };
    gorulen.add(anahtar);
    kayitlar.push(d.kayit);
  }
  return { handle, kayitlar };
}

const esit = (a: Array<{ soru: string; cevap: string }>, b: Array<{ soru: string; cevap: string }>) =>
  a.length === b.length && a.every((x, i) => x.soru === b[i]!.soru && x.cevap.trim() === b[i]!.cevap.trim());

/**
 * JSONL satırlarını işler. `uygula` verilmezse DRY-RUN: yalnız okur ve kütüğe "yazılacak" der.
 * Dönen özet sayılar kütükle birebir aynıdır.
 */
export async function sssIceAktar(
  satirlar: string[],
  dep: IceAktarBagimliliklari,
  ayar: { uygula?: boolean } = {},
): Promise<Record<IceAktarSonuc, number>> {
  const uygula = ayar.uygula === true;
  const kip: KutukSatiri['kip'] = uygula ? 'uygula' : 'dry-run';
  const ozet = {
    'dry-run-yazilacak': 0, yazildi: 0, 'yazildi-senkron-hatasi': 0, 'zaten-yazili': 0,
    'mevcut-sss-var': 0, 'urun-yok': 0, reddedildi: 0, hata: 0,
  } as Record<IceAktarSonuc, number>;
  const islenen = new Set<string>();

  for (let i = 0; i < satirlar.length; i++) {
    const ham = satirlar[i]!.trim();
    if (!ham) continue;
    const kaydet = async (handle: string, sonuc: IceAktarSonuc, sebep: string, soruSayisi = 0) => {
      ozet[sonuc]++;
      await dep.kutuk({ satir: i + 1, handle, sonuc, sebep, kip, soruSayisi });
    };
    const a = satirAyristir(ham);
    if ('hata' in a) { await kaydet(a.handle, 'reddedildi', a.hata); continue; }
    if (islenen.has(a.handle)) { await kaydet(a.handle, 'reddedildi', 'aynı handle girdide ikinci kez'); continue; }
    islenen.add(a.handle);
    try {
      if (!(await dep.urunVarMi(a.handle))) { await kaydet(a.handle, 'urun-yok', "Shopify'da bu handle'lı ürün yok"); continue; }
      const mevcut = await dep.mevcutOku(a.handle);
      if (mevcut.length > 0) {
        if (esit(mevcut, a.kayitlar)) await kaydet(a.handle, 'zaten-yazili', 'aynı küme zaten kayıtlı', a.kayitlar.length);
        else await kaydet(a.handle, 'mevcut-sss-var', `üründe ${mevcut.length} SSS zaten var — ezilmez`, a.kayitlar.length);
        continue;
      }
      if (!uygula) { await kaydet(a.handle, 'dry-run-yazilacak', 'dry-run — yazılmadı', a.kayitlar.length); continue; }
      await dep.yaz(a.handle, a.kayitlar);
      const s = await dep.senkronla(a.handle, a.kayitlar);
      if (s.ok) await kaydet(a.handle, 'yazildi', 'DB + metafield', a.kayitlar.length);
      else await kaydet(a.handle, 'yazildi-senkron-hatasi', `DB yazıldı, metafield: ${s.hata ?? 'bilinmeyen'}`, a.kayitlar.length);
    } catch (e) {
      await kaydet(a.handle, 'hata', String((e as Error)?.message ?? e).slice(0, 200));
    }
  }
  return ozet;
}
