/**
 * İndirim kuponu KAPSAM ÇÖZÜCÜ — tek güvenilir kaynak.
 *
 * Neden var: kupon tutarını eskiden FRONTEND hesaplayıp `discount_amount` olarak
 * gönderiyordu ve sunucu ona güveniyordu. Shopify'ın price rule'undaki ÜRÜN KISITI
 * (target_selection='entitled') hiç okunmadığı için, tek ürüne tanımlı 200 TL'lik
 * 18SETFIRSAT sepetteki HERHANGİ bir ucuz ürüne uygulanabiliyor ve toplamı 0'a
 * indiriyordu (11 Ağu 2026 açığı).
 *
 * İlk düzeltme kapsamlı kuponları topyekûn reddetti — açık kapandı ama kampanya
 * mobilde kullanılamaz oldu (mobil ürün detayında kod alanı yok; kod yalnız ödeme
 * sayfasından giriliyor). Bu modül doğru dengeyi kurar:
 *
 *   İndirim SADECE hak eden satırlara, O SATIRLARIN TUTARIYLA SINIRLI uygulanır.
 *   Sepette hak eden ürün yoksa → indirim yok (net hata).
 *
 * Hesap SUNUCUDA yapılır; istemciden gelen tutara asla güvenilmez.
 */
import { env } from '@/lib/env';

export interface DiscountLineInput {
  variant_id: number;
  quantity: number;
  /** Birim fiyat — KURUŞ (tema cart.js `item.price` gönderir: indirim ÖNCESİ ham fiyat) */
  price?: number;
}

/** Kuponu uygulayan müşteri — kullanım limiti kontrolü için */
export interface DiscountCustomer {
  email?: string;
  phone?: string;
  customerId?: number;
}

/** E-posta/telefonu karşılaştırılabilir hale getirir (büyük-küçük, boşluk, +90/0 önekleri) */
function normEmail(e?: string | null): string {
  return (e ?? '').trim().toLowerCase();
}
function normPhone(p?: string | null): string {
  const d = (p ?? '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}

interface Redemptions {
  /** İptal edilmemiş, bu kuponu taşıyan sipariş sayısı */
  total: number;
  emails: Set<string>;
  phones: Set<string>;
  customerIds: Set<number>;
}

/**
 * Kuponun GERÇEK kullanım sayısı.
 *
 * Shopify'ın kendi sayacı (asyncUsageCount) BİZİM akışımızı SAYMIYOR: siparişi biz
 * Orders API ile açıp `discount_codes` yazdığımızda Shopify bunu price rule'un
 * redemption'ı saymıyor — 11 gerçek kullanımda sayaç 2 görünüyordu (11 Ağu). Bu yüzden
 * sayım, kodu taşıyan SİPARİŞLER üzerinden yapılır: hem bizim akışımızı hem Shopify'ın
 * kendi checkout'undan geçenleri kapsar, çift saymaz.
 */
async function countRedemptions(code: string): Promise<Redemptions | null> {
  const sb = shopBase();
  const out: Redemptions = { total: 0, emails: new Set(), phones: new Set(), customerIds: new Set() };
  if (!sb) return null;
  const q = `
    query($q: String!) {
      orders(first: 250, query: $q) {
        edges { node { cancelledAt email phone customer { id phone email } } }
      }
    }`;
  try {
    const resp = await fetch(`${sb.base}/graphql.json`, {
      method: 'POST',
      headers: sb.headers,
      body: JSON.stringify({
        query: q,
        variables: { q: `discount_code:${JSON.stringify(code)} status:any` },
      }),
    });
    if (!resp.ok) return null;
    const j = (await resp.json()) as {
      errors?: unknown;
      data?: {
        orders?: {
          edges?: Array<{
            node?: {
              cancelledAt?: string | null;
              email?: string | null;
              phone?: string | null;
              customer?: { id?: string; phone?: string | null; email?: string | null } | null;
            };
          }>;
        };
      };
    };
    if (j.errors || !j.data?.orders?.edges) return null;
    for (const e of j.data.orders.edges) {
      const n = e.node;
      if (!n || n.cancelledAt) continue; // iptal edilen sipariş kullanım saymaz
      out.total += 1;
      const em = normEmail(n.email ?? n.customer?.email);
      if (em) out.emails.add(em);
      const ph = normPhone(n.phone ?? n.customer?.phone);
      if (ph) out.phones.add(ph);
      const cid = Number(String(n.customer?.id ?? '').split('/').pop());
      if (cid) out.customerIds.add(cid);
    }
    return out;
  } catch {
    return null;
  }
}

export interface DiscountResolved {
  ok: true;
  code: string;
  type: 'percentage' | 'fixed_amount';
  /** Ham price rule değeri (yüzde ör. 10 · sabit TL ör. 200) — sadece bilgi amaçlı */
  value: number;
  minSubtotal: number;
  /** Kapsamlı kupon mu (belirli ürün/koleksiyon) */
  scoped: boolean;
  /** GÜVENİLİR indirim tutarı — KURUŞ. Hak eden satır toplamını asla aşmaz. */
  amountKurus: number;
  /** Hak eden satırların toplamı — KURUŞ */
  eligibleSubtotalKurus: number;
}
export interface DiscountRejected {
  ok: false;
  error: string;
}
export type DiscountResult = DiscountResolved | DiscountRejected;

interface PriceRule {
  id: number;
  value_type: string;
  value: string;
  starts_at: string | null;
  ends_at: string | null;
  target_type?: string;
  target_selection?: string;
  allocation_method?: string;
  customer_selection?: string;
  entitled_product_ids?: number[];
  entitled_variant_ids?: number[];
  entitled_collection_ids?: number[];
  prerequisite_subtotal_range?: { greater_than_or_equal_to: string } | null;
  /** Toplam kullanım hakkı (null = sınırsız) */
  usage_limit?: number | null;
  /** Müşteri başına 1 kullanım */
  once_per_customer?: boolean;
}

function shopBase(): { base: string; headers: Record<string, string> } | null {
  const token = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token) return null;
  return {
    base: `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}`,
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
  };
}

/**
 * variant_id → { productId, koleksiyon üyelikleri }. Kapsam kontrolü için gerekli.
 * Çözülemeyen varyant "hak etmiyor" sayılır (fail-closed).
 */
async function resolveVariantScope(
  variantIds: number[],
  collectionIds: number[],
): Promise<Map<number, { productId: number; collections: Set<number> }>> {
  const out = new Map<number, { productId: number; collections: Set<number> }>();
  const sb = shopBase();
  if (!sb || variantIds.length === 0) return out;

  const collFields = collectionIds
    .slice(0, 10)
    .map((cid, i) => `c${i}: inCollection(id: "gid://shopify/Collection/${cid}")`)
    .join('\n            ');

  const query = `
    query($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          product {
            id
            ${collFields}
          }
        }
      }
    }`;

  const resp = await fetch(`${sb.base}/graphql.json`, {
    method: 'POST',
    headers: sb.headers,
    body: JSON.stringify({
      query,
      variables: { ids: variantIds.map((v) => `gid://shopify/ProductVariant/${v}`) },
    }),
  });
  if (!resp.ok) return out;
  const j = (await resp.json()) as {
    data?: { nodes?: Array<{ id?: string; product?: Record<string, unknown> } | null> };
  };
  for (const n of j.data?.nodes ?? []) {
    if (!n?.id || !n.product) continue;
    const vid = Number(String(n.id).split('/').pop());
    const pid = Number(String(n.product.id).split('/').pop());
    const cols = new Set<number>();
    collectionIds.slice(0, 10).forEach((cid, i) => {
      if (n.product?.[`c${i}`] === true) cols.add(cid);
    });
    if (vid && pid) out.set(vid, { productId: pid, collections: cols });
  }
  return out;
}

/**
 * Kuponu sepete göre çözer ve GÜVENİLİR indirim tutarını döner.
 * lineItems boş verilirse kapsam hesaplanamaz → kapsamlı kupon reddedilir.
 */
export async function resolveDiscount(
  rawCode: string,
  lineItems: DiscountLineInput[],
  customer: DiscountCustomer = {},
): Promise<DiscountResult> {
  const code = (rawCode || '').trim();
  if (!code) return { ok: false, error: 'Kod boş.' };
  const sb = shopBase();
  if (!sb) return { ok: false, error: 'config' };

  const lookup = await fetch(
    `${sb.base}/discount_codes/lookup.json?code=${encodeURIComponent(code)}`,
    { headers: sb.headers, redirect: 'follow' },
  );
  if (lookup.status === 404) return { ok: false, error: 'Bu indirim kodu geçersiz.' };
  if (!lookup.ok) return { ok: false, error: 'Kod doğrulanamadı.' };
  const lj = (await lookup.json()) as { discount_code?: { price_rule_id: number; code: string } };
  const priceRuleId = lj.discount_code?.price_rule_id;
  if (!priceRuleId) return { ok: false, error: 'Bu indirim kodu geçersiz.' };

  const prResp = await fetch(`${sb.base}/price_rules/${priceRuleId}.json`, { headers: sb.headers });
  if (!prResp.ok) return { ok: false, error: 'Kod doğrulanamadı.' };
  const pr = ((await prResp.json()) as { price_rule: PriceRule }).price_rule;

  if (pr.value_type !== 'percentage' && pr.value_type !== 'fixed_amount') {
    return { ok: false, error: 'Bu kupon bu sayfada uygulanamıyor.' };
  }
  // Kargo indirimi: tema kargo satırını ayrı hesaplıyor, burada uygulanamaz
  if (pr.target_type && pr.target_type !== 'line_item') {
    return { ok: false, error: 'Bu kupon bu sayfada uygulanamıyor.' };
  }
  // Kişiye özel kuponlar doğrulanamaz (müşteri segmenti bilgisi yok) → fail-closed
  if (pr.customer_selection && pr.customer_selection !== 'all') {
    return { ok: false, error: 'Bu kupon hesabınıza tanımlı değil.' };
  }
  const now = Date.now();
  if (pr.starts_at && new Date(pr.starts_at).getTime() > now) {
    return { ok: false, error: 'Bu kupon henüz başlamadı.' };
  }
  if (pr.ends_at && new Date(pr.ends_at).getTime() < now) {
    return { ok: false, error: 'Bu kuponun süresi dolmuş.' };
  }

  // ── KULLANIM LİMİTİ (11 Ağu 2026 — canlı suistimal) ─────────────────────────
  // Shopify limitleri YALNIZCA kendi checkout'unda uygular. Bizim özel akışımızda
  // sipariş Orders API ile açılıp `discount_codes` yazıldığı için Shopify bunu
  // redemption saymıyor: 10 kullanımlık kupon 11 kez kullanıldı, sayaç 2 gösterdi ve
  // aynı e-posta (suleymandanaci99@) iki kez sipariş verdi. Limitleri BİZ uygulamalıyız.
  const usageLimit = pr.usage_limit ?? null;
  const oncePerCustomer = pr.once_per_customer === true;
  if (usageLimit != null || oncePerCustomer) {
    const red = await countRedemptions(lj.discount_code?.code || code);
    if (!red) {
      // Sayım yapılamadı (API hatası) → limitli kuponu uygulama. Fail-closed:
      // aşırı kullanım geri alınamaz, "tekrar deneyin" geri alınabilir.
      console.error('[discount] kullanım sayımı başarısız — limitli kupon reddedildi', { code });
      return { ok: false, error: 'Kupon şu anda doğrulanamıyor, lütfen tekrar deneyin.' };
    }
    if (usageLimit != null && red.total >= usageLimit) {
      return { ok: false, error: 'Bu kuponun kullanım hakkı doldu.' };
    }
    if (oncePerCustomer) {
      const em = normEmail(customer.email);
      const ph = normPhone(customer.phone);
      const used =
        (em && red.emails.has(em)) ||
        (ph && red.phones.has(ph)) ||
        (customer.customerId != null && red.customerIds.has(customer.customerId));
      if (used) {
        return { ok: false, error: 'Bu kuponu daha önce kullandınız.' };
      }
    }
  }

  const value = Math.abs(parseFloat(pr.value));
  const minSubtotal = pr.prerequisite_subtotal_range?.greater_than_or_equal_to
    ? parseFloat(pr.prerequisite_subtotal_range.greater_than_or_equal_to)
    : 0;

  const prodIds = pr.entitled_product_ids ?? [];
  const varIds = pr.entitled_variant_ids ?? [];
  const colIds = pr.entitled_collection_ids ?? [];
  const scoped =
    pr.target_selection === 'entitled' || prodIds.length > 0 || varIds.length > 0 || colIds.length > 0;

  const lines = (lineItems ?? []).filter((l) => l && l.variant_id && l.quantity > 0);
  const cartSubtotalKurus = lines.reduce((s, l) => s + Math.round(l.price ?? 0) * l.quantity, 0);

  if (minSubtotal > 0 && cartSubtotalKurus / 100 < minSubtotal) {
    return { ok: false, error: `Bu kupon en az ${minSubtotal.toFixed(0)} TL sepet tutarında geçerli.` };
  }

  // ── Hak eden satırları belirle ──────────────────────────────────────────────
  let eligible = lines;
  if (scoped) {
    if (lines.length === 0) {
      // Sepet bilgisi yok → kapsam hesaplanamaz. Sessizce tüm sepete uygulamak
      // eski açığı geri getirirdi → fail-closed.
      return { ok: false, error: 'Bu kupon yalnızca belirli ürünlerde geçerli.' };
    }
    const scopeMap = await resolveVariantScope(
      [...new Set(lines.map((l) => l.variant_id))],
      colIds,
    );
    eligible = lines.filter((l) => {
      if (varIds.includes(l.variant_id)) return true;
      const info = scopeMap.get(l.variant_id);
      if (!info) return false; // çözülemedi → hak etmiyor
      if (prodIds.includes(info.productId)) return true;
      return colIds.some((c) => info.collections.has(c));
    });
    if (eligible.length === 0) {
      return { ok: false, error: 'Bu kupon sepetindeki ürünlerde geçerli değil.' };
    }
  }

  const eligibleSubtotalKurus = eligible.reduce(
    (s, l) => s + Math.round(l.price ?? 0) * l.quantity,
    0,
  );
  if (eligibleSubtotalKurus <= 0) {
    return { ok: false, error: 'Bu kupon sepetindeki ürünlerde geçerli değil.' };
  }

  let amountKurus: number;
  if (pr.value_type === 'percentage') {
    amountKurus = Math.round((eligibleSubtotalKurus * value) / 100);
  } else if (pr.allocation_method === 'each') {
    // Sabit tutar HER hak eden üründe ayrı ayrı
    const qty = eligible.reduce((s, l) => s + l.quantity, 0);
    amountKurus = Math.round(value * 100) * qty;
  } else {
    // 'across' — sabit tutar hak eden satırlara TOPLAMDA bir kez
    amountKurus = Math.round(value * 100);
  }
  // ANA GÜVENLİK SINIRI: indirim, hak eden satırların toplamını ASLA aşamaz
  amountKurus = Math.max(0, Math.min(amountKurus, eligibleSubtotalKurus));

  return {
    ok: true,
    code: lj.discount_code?.code || code,
    type: pr.value_type,
    value,
    minSubtotal,
    scoped,
    amountKurus,
    eligibleSubtotalKurus,
  };
}

/**
 * Ödeme/sipariş uçlarında kullanılır: istemcinin gönderdiği tutara GÜVENMEZ,
 * kuponu sepete göre yeniden hesaplar. Kupon yoksa/geçersizse 0 döner (sipariş
 * indirimsiz devam eder — müşteriyi ödeme anında bloklamayız).
 */
/**
 * Kuponu güvenilir biçimde çözer VE reddedildiyse SEBEBİNİ de döndürür.
 *
 * Neden: `trustedDiscountTl()` reddi SESSİZCE 0'a çeviriyordu. Müşteri sepette indirimi
 * görüp ödeme adımında indirimsiz tutarla karşılaşıyor, neden olduğunu anlamıyordu
 * (Yunus, 27 Ağu 2026 — OZEL10 "sepette yansıdı, PayTR'de yansımadı"). Kök neden:
 * sepette müşterinin e-postası/telefonu HENÜZ BİLİNMİYOR, bu yüzden "tek müşteri bir kez"
 * kontrolü orada çalışmıyor; ödeme anında kimlik biliniyor ve kupon haklı olarak düşüyor.
 * Ödeme yolları artık sessizce devam etmek yerine bu sebebi müşteriye gösterir.
 */
export async function trustedDiscountDetailed(
  code: string | undefined,
  lineItems: DiscountLineInput[],
  customer: DiscountCustomer = {},
): Promise<{ amountTl: number; rejected?: string }> {
  if (!code?.trim()) return { amountTl: 0 };
  try {
    const r = await resolveDiscount(code, lineItems, customer);
    if (!r.ok) {
      console.warn('[discount] sipariş anında kupon reddedildi', { code, reason: r.error });
      return { amountTl: 0, rejected: r.error };
    }
    return { amountTl: r.amountKurus / 100 };
  } catch (e) {
    console.error('[discount] kupon çözümlenemedi', { code, error: String(e) });
    return { amountTl: 0, rejected: 'Kupon doğrulanamadı, lütfen tekrar deneyin.' };
  }
}

export async function trustedDiscountTl(
  code: string | undefined,
  lineItems: DiscountLineInput[],
  customer: DiscountCustomer = {},
): Promise<number> {
  if (!code?.trim()) return 0;
  try {
    const r = await resolveDiscount(code, lineItems, customer);
    if (!r.ok) {
      console.warn('[discount] sipariş anında kupon reddedildi', { code, reason: r.error });
      return 0;
    }
    return r.amountKurus / 100;
  } catch {
    return 0;
  }
}
