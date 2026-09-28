/**
 * DB → Shopify metafield SENKRONU (tek yönlü, DB otorite) — #991833-B.
 *
 * NEDEN GEREKLİ: ürün SSS'leri kendi tablomuzda (`urun_sss`) duruyor ama ürün
 * sayfasını Shopify teması basıyor ve **Liquid veritabanımıza erişemez**. Tema
 * ancak ürünün metafield'ını okuyabilir. Bu yüzden DB'ye her yazımdan sonra
 * aynı veri metafield'a yansıtılır. Yön TEK: DB otorite, Shopify kopya.
 *
 * ⚠ BOŞ KÜME METAFIELD'I BOŞALTIR — sessizce atlamaz. Son soru silindiğinde
 * metafield'a dokunulmazsa tema eski listeyi basmaya devam eder ve silinen soru
 * sayfada ASILI KALIR ("artık veri" sınıfı). Bu yüzden boş küme `[]` yazar.
 *
 * ⚠ HATA YUTULMAZ: senkron başarısızsa `{ok:false, hata}` döner ve admin ekranı
 * sebebi gösterir. Sessiz geçmek, "admin'e girdim ama sayfada yok" hâlini
 * teşhis edilemez kılar — bu depoda ölçülmüş "besleyen halka kopuk" ailesi.
 */
import type { SssKayit } from './urun-sss';

export const SSS_METAFIELD_NS = 'custom';
export const SSS_METAFIELD_KEY = 'sss';
/** JSON liste — tema `product.metafields.custom.sss.value` ile dizi olarak okur. */
export const SSS_METAFIELD_TIP = 'json';

export type SenkronSonuc = { ok: true; yazilan: number } | { ok: false; hata: string };

/** Kill switch — açık değilse Shopify'a HİÇBİR istek gitmez. */
export function senkronAcikMi(env: Record<string, string | undefined> = process.env): boolean {
  return String(env.SSS_METAFIELD_SENKRON ?? '').trim() === '1';
}

/**
 * Metafield gövdesi. Tema `soru`/`cevap` alanlarını okur; `sira` DB'de kalır,
 * listeye GİRMEZ çünkü dizi zaten sıralı gelir ve iki yerde sıra tutmak
 * ayrışma üretir (bu deponun "kopya = sessiz kayma" sınıfı).
 */
export function metafieldGovdesi(kayitlar: ReadonlyArray<SssKayit>): string {
  const liste = [...kayitlar]
    .sort((a, b) => (a.sira - b.sira) || a.soru.localeCompare(b.soru, 'tr'))
    .map((k) => ({ soru: k.soru, cevap: k.cevap }));
  return JSON.stringify(liste);
}

/** GraphQL `metafieldsSet` girdisi. `ownerId` Shopify gid'i. */
export function metafieldGirdisi(urunGid: string, kayitlar: ReadonlyArray<SssKayit>) {
  return {
    ownerId: urunGid,
    namespace: SSS_METAFIELD_NS,
    key: SSS_METAFIELD_KEY,
    type: SSS_METAFIELD_TIP,
    value: metafieldGovdesi(kayitlar),
  };
}

/**
 * Yanıttaki kullanıcı hatalarını okunur tek satıra indirir.
 * `metafieldsSet` HTTP 200 dönüp gövdede `userErrors` taşıyabilir — yalnız
 * durum koduna bakmak bu sınıfı kaçırır.
 */
export function yanitHatasi(yanit: unknown): string | null {
  const y = yanit as {
    errors?: unknown;
    data?: { metafieldsSet?: { userErrors?: Array<{ field?: string[]; message?: string }> } };
  } | null;
  if (!y) return 'boş yanıt';
  if (y.errors) return 'graphql: ' + JSON.stringify(y.errors).slice(0, 200);
  const ue = y.data?.metafieldsSet?.userErrors;
  if (Array.isArray(ue) && ue.length > 0) {
    return ue.map((e) => `${(e.field ?? []).join('.')}: ${e.message ?? 'bilinmeyen'}`).join(' · ').slice(0, 300);
  }
  return null;
}
