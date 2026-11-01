/**
 * #995648 · ÜRÜN ↔ GÖRSEL BAĞINI ÇÖZME — dosya SİLİNMEZ (koordinasyon kararı 1 Kas 2026).
 *
 * Olay: Jada Stitch Hula ve Ukulele ürün sayfalarında bizim ürettiğimiz bir tanıtım görseli «RESMİ LİSANSLI VE YETKİLİ
 * SATICI © Disney» · «BU GÖRSEL VE ÜRÜNLER TİCARİ KULLANIM İÇİN YETKİLİDİR © Disney» beyanı ve Disney logosu taşıyor;
 * yetkili satıcılık belgelenmiş değil. Karar: görsel ürün sayfasından KALKAR, dosya Shopify Files'ta KALIR, ürün satışta kalır.
 *
 * YOL: `fileUpdate(files:[{id, referencesToRemove:[ürün]}])` — yalnız ürün bağını kaldırır, dosya Files'ta durur.
 * ⛔ `productDeleteMedia` KULLANILMAZ: belgeye göre geri alınamaz siler. Geri alma: aynı kapıdan `referencesToAdd:[ürün]`
 * (görsel galerinin sonuna eklenir; burada zaten SON sıradaydı, sıra birebir geri gelir).
 *
 * KAPI — ürün ancak HEPSİ sağlanırsa yazılır:
 *   1. canlı ürün id'si ve handle'ı girdiyle aynı,
 *   2. canlı galeri sırası = kütükteki öncesi (bayt bayt aynı id dizisi; değiştiyse başka biri dokunmuş → ATLA),
 *   3. hedef medya galeride TAM bir kez geçer ve CDN adresi beklenen dosya adını taşır,
 *   4. hedef medya ANA görsel değildir (ana görsel stratejisi bu kararın dışında) ve sonrasında en az 1 görsel kalır,
 *   5. ÖNCESİ (tam galeri sırası + ana görsel) kütüğe yazılmadan bağ çözme koşmaz; yazmadan önce yeniden okunur,
 *   6. SONRASI ölçülür: galeri = öncesi eksi hedef (kalanların sırası aynı) VE dosya hâlâ Files'ta (fileStatus READY).
 *      Dosya kaybolduysa iş DURUR — kalan ürünlere dokunulmaz (kalıcı silme kırmızı çizgisi).
 *
 * Çivi: tests/gorsel-bag-coz.test.ts.
 */
export type Giris = {
  handle: string; urunId: string; mediaId: string; dosyaAdi: string;
  galeriOnce: string[]; anaGorselOnce: string; gerekce: string;
};
export type Canli = { urunId: string; handle: string; galeri: Array<{ id: string; url: string }>; anaGorsel: string | null };

export type Karar =
  | { durum: 'yazilacak'; beklenenSonra: string[] }
  | { durum: 'degisiklik-yok'; sebep: string }
  | { durum: 'atlandi'; sebep: string };

export function karar(g: Giris, c: Canli): Karar {
  if (c.urunId !== g.urunId || c.handle !== g.handle) return { durum: 'atlandi', sebep: 'ürün kimliği/handle girdiden farklı — yazılmadı' };
  const ids = c.galeri.map((m) => m.id);
  const beklenenSonra = g.galeriOnce.filter((x) => x !== g.mediaId);
  if (JSON.stringify(ids) === JSON.stringify(beklenenSonra) && !ids.includes(g.mediaId)) return { durum: 'degisiklik-yok', sebep: 'bağ zaten çözülmüş' };
  if (JSON.stringify(ids) !== JSON.stringify(g.galeriOnce)) return { durum: 'atlandi', sebep: 'canlı galeri sırası kütükteki öncesinden farklı — yazılmadı' };
  const es = c.galeri.filter((m) => m.id === g.mediaId);
  if (es.length !== 1) return { durum: 'atlandi', sebep: `hedef medya galeride ${es.length} kez geçiyor — yazılmadı` };
  if (!g.dosyaAdi || !es[0]!.url.split('?')[0]!.endsWith('/' + g.dosyaAdi)) return { durum: 'atlandi', sebep: 'hedef medyanın dosya adı beklenenle aynı değil — yazılmadı' };
  if (c.anaGorsel === g.mediaId || g.anaGorselOnce === g.mediaId) return { durum: 'atlandi', sebep: 'hedef medya ANA görsel — ana görsel stratejisi bu kararın dışında, yazılmadı' };
  if (c.anaGorsel !== g.anaGorselOnce) return { durum: 'atlandi', sebep: 'ana görsel kütükteki öncesinden farklı — yazılmadı' };
  if (beklenenSonra.length < 1) return { durum: 'atlandi', sebep: 'bağ çözülünce üründe görsel kalmıyor — yazılmadı' };
  if (!g.gerekce?.trim()) return { durum: 'atlandi', sebep: 'gerekçe boş — yazılmadı' };
  return { durum: 'yazilacak', beklenenSonra };
}

export type KutukSatiri = {
  handle: string; mediaId: string;
  durum: 'yazilacak' | 'oncesi-kaydedildi' | 'yazildi' | 'degisiklik-yok' | 'atlandi' | 'hata' | 'geri-alindi';
  sebep?: string; galeriOnce?: string[]; anaGorselOnce?: string | null; galeriSonra?: string[]; anaGorselSonra?: string | null;
  dosya?: { fileStatus: string | null; url: string | null }; gerekce?: string;
};
export type Ozet = { taranan: number; yazilacak: number; yazildi: number; degisiklikYok: number; atlandi: number; hata: number; durdu: boolean };

export type Bagimlilik = {
  oku: (handle: string) => Promise<Canli | null>;
  /** Dosya Files'ta mı (node sorgusu). Yoksa null. */
  dosya: (mediaId: string) => Promise<{ fileStatus: string | null; url: string | null } | null>;
  bagCoz: (mediaId: string, urunId: string) => Promise<{ ok: true } | { ok: false; hata: string }>;
  kutuk: (s: KutukSatiri) => void;
};

/** `uygula` false iken bagCoz HİÇ çağrılmaz. Dosya kaybolursa ya da sonrası beklenenden farklıysa iş DURUR. */
export async function bagCozCalistir(girisler: Giris[], dep: Bagimlilik, sec: { uygula: boolean }): Promise<Ozet> {
  const oz: Ozet = { taranan: 0, yazilacak: 0, yazildi: 0, degisiklikYok: 0, atlandi: 0, hata: 0, durdu: false };
  for (const g of girisler) {
    oz.taranan++;
    const tem = { handle: g.handle, mediaId: g.mediaId };
    try {
      const c = await dep.oku(g.handle);
      if (!c) { oz.atlandi++; dep.kutuk({ ...tem, durum: 'atlandi', sebep: 'ürün bulunamadı' }); continue; }
      const k = karar(g, c);
      if (k.durum === 'degisiklik-yok') { oz.degisiklikYok++; dep.kutuk({ ...tem, durum: 'degisiklik-yok', sebep: k.sebep }); continue; }
      if (k.durum === 'atlandi') { oz.atlandi++; dep.kutuk({ ...tem, durum: 'atlandi', sebep: k.sebep, galeriOnce: c.galeri.map((m) => m.id) }); continue; }
      const once = { galeriOnce: c.galeri.map((m) => m.id), anaGorselOnce: c.anaGorsel, gerekce: g.gerekce };
      if (!sec.uygula) { oz.yazilacak++; dep.kutuk({ ...tem, durum: 'yazilacak', ...once, galeriSonra: k.beklenenSonra }); continue; }
      const c2 = await dep.oku(g.handle);
      if (!c2 || JSON.stringify(c2) !== JSON.stringify(c)) { oz.atlandi++; dep.kutuk({ ...tem, durum: 'atlandi', sebep: 'okuma ile yazma arasında ürün değişti — yazılmadı' }); continue; }
      dep.kutuk({ ...tem, durum: 'oncesi-kaydedildi', ...once }); // atarsa aşağısı KOŞMAZ
      const r = await dep.bagCoz(g.mediaId, g.urunId);
      if (!r.ok) { oz.hata++; dep.kutuk({ ...tem, durum: 'hata', sebep: r.hata }); continue; }
      const s = await dep.oku(g.handle), f = await dep.dosya(g.mediaId);
      const sonra = { galeriSonra: s?.galeri.map((m) => m.id), anaGorselSonra: s?.anaGorsel ?? null, dosya: f ?? undefined };
      if (!f || f.fileStatus !== 'READY') {
        oz.hata++; oz.durdu = true;
        dep.kutuk({ ...tem, durum: 'hata', sebep: 'DOSYA FILES\'TA GÖRÜNMÜYOR — iş DURDU, kalan ürünlere dokunulmadı', ...sonra });
        break;
      }
      if (JSON.stringify(sonra.galeriSonra) !== JSON.stringify(k.beklenenSonra) || sonra.anaGorselSonra !== c.anaGorsel) {
        oz.hata++; oz.durdu = true;
        dep.kutuk({ ...tem, durum: 'hata', sebep: 'sonrası beklenenden farklı (galeri sırası ya da ana görsel) — iş DURDU', ...sonra });
        break;
      }
      oz.yazildi++; dep.kutuk({ ...tem, durum: 'yazildi', ...sonra });
    } catch (e) {
      oz.hata++;
      try { dep.kutuk({ ...tem, durum: 'hata', sebep: e instanceof Error ? e.message : String(e) }); } catch { /* kütük yazılamıyorsa yalnız sayaç */ }
    }
  }
  return oz;
}

/** GERİ ALMA: bağı yeniden kurar (referencesToAdd) ve galeri sırasının ÖNCESİ ile birebir aynı olduğunu ölçer. */
export async function geriAlCalistir(
  girisler: Giris[],
  dep: Pick<Bagimlilik, 'oku' | 'kutuk'> & { bagKur: (mediaId: string, urunId: string) => Promise<{ ok: true } | { ok: false; hata: string }> },
): Promise<{ geriAlindi: number; hata: number }> {
  let geriAlindi = 0, hata = 0;
  for (const g of girisler) {
    const tem = { handle: g.handle, mediaId: g.mediaId };
    const c = await dep.oku(g.handle);
    if (c?.galeri.some((m) => m.id === g.mediaId)) { dep.kutuk({ ...tem, durum: 'degisiklik-yok', sebep: 'bağ zaten kurulu' }); continue; }
    const r = await dep.bagKur(g.mediaId, g.urunId);
    const s = await dep.oku(g.handle);
    const ids = s?.galeri.map((m) => m.id) ?? [];
    if (!r.ok || JSON.stringify(ids) !== JSON.stringify(g.galeriOnce)) { hata++; dep.kutuk({ ...tem, durum: 'hata', sebep: r.ok ? 'geri alındı ama galeri sırası öncesinden farklı' : r.hata, galeriSonra: ids }); continue; }
    geriAlindi++; dep.kutuk({ ...tem, durum: 'geri-alindi', galeriSonra: ids });
  }
  return { geriAlindi, hata };
}
