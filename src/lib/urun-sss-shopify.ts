/**
 * SENKRON ÇAĞIRAN TARAF — handle → gid çevrimi + metafieldsSet (#991833-C).
 *
 * `fetch` DIŞARIDAN VERİLİR (varsayılan global). Sebep: kill switch kapalıyken
 * "hiçbir ağ çağrısı yapılmadığını" ancak sahte istemciyle ölçebiliriz; gerçek
 * fetch'e bağlı bir modül bu iddiayı çiviye çeviremez.
 *
 * ⚠ HATA YUTULMAZ: handle bulunamazsa, yetki yoksa ya da `userErrors` dolarsa
 * `{ok:false, hata}` döner; admin ekranı sebebi gösterir. Sessiz geçmek
 * "girdim ama sayfada yok" hâlini teşhis edilemez kılar.
 */
import type { SssKayit } from './urun-sss';
import { metafieldGirdisi, senkronAcikMi, yanitHatasi, SSS_METAFIELD_NS, SSS_METAFIELD_KEY } from './urun-sss-senkron';

export type Getirici = (url: string, init: RequestInit) => Promise<Response>;
export type SenkronCevap = { ok: true; atlandi?: 'kapali'; yazilan?: number } | { ok: false; hata: string };

type Ayar = {
  domain?: string; token?: string; surum?: string;
  getir?: Getirici; env?: Record<string, string | undefined>;
};

function uc(a: Ayar): { url: string; token: string } | null {
  const e = a.env ?? process.env;
  const domain = (a.domain ?? e.SHOPIFY_STORE_DOMAIN ?? '').trim();
  const token = (a.token ?? e.SHOPIFY_ADMIN_ACCESS_TOKEN ?? '').trim();
  const surum = (a.surum ?? e.SHOPIFY_API_VERSION ?? '2025-01').trim();
  if (!domain || !token) return null;
  return { url: `https://${domain}/admin/api/${surum}/graphql.json`, token };
}

async function sorgu(a: Ayar, govde: unknown): Promise<unknown> {
  const u = uc(a);
  if (!u) throw new Error('shopify ayarı eksik');
  const getir = a.getir ?? (globalThis.fetch as unknown as Getirici);
  const r = await getir(u.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': u.token },
    body: JSON.stringify(govde),
  });
  return r.json();
}

/** handle → Shopify ürün gid. Bulunamazsa null (çağıran hata yazar). */
export async function handleGid(handle: string, a: Ayar = {}): Promise<string | null> {
  const y = (await sorgu(a, {
    query: 'query($h:String!){ productByHandle(handle:$h){ id } }',
    variables: { h: handle },
  })) as { data?: { productByHandle?: { id?: string } | null } };
  return y?.data?.productByHandle?.id ?? null;
}

/**
 * Bir ürünün SSS'lerini metafield'a yazar.
 *
 * Kill switch KAPALIYSA hiçbir ağ çağrısı YAPILMAZ — ilk satırda döner.
 * Boş küme gelirse metafield `[]` ile BOŞALTILIR (silinen soru temada asılı kalmasın).
 */
export async function sssSenkronla(
  handle: string,
  kayitlar: ReadonlyArray<SssKayit>,
  a: Ayar = {},
): Promise<SenkronCevap> {
  if (!senkronAcikMi(a.env ?? process.env)) return { ok: true, atlandi: 'kapali' };
  if (!handle) return { ok: false, hata: 'ürün handle boş' };
  try {
    const gid = await handleGid(handle, a);
    if (!gid) return { ok: false, hata: `Shopify'da "${handle}" handle'lı ürün bulunamadı` };
    const yanit = await sorgu(a, {
      query:
        'mutation($m:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$m){ metafields{ namespace key } userErrors{ field message } } }',
      variables: { m: [metafieldGirdisi(gid, kayitlar)] },
    });
    const hata = yanitHatasi(yanit);
    if (hata) return { ok: false, hata };
    return { ok: true, yazilan: kayitlar.length };
  } catch (e) {
    return { ok: false, hata: 'senkron hatası: ' + ((e as Error)?.message ?? 'bilinmeyen') };
  }
}

export const SENKRON_ALAN = `${SSS_METAFIELD_NS}.${SSS_METAFIELD_KEY}`;
