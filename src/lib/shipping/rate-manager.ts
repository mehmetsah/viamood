/**
 * Rate Manager — vendor platform tek doğruluk kaynağı.
 *
 * Pipeline:
 *   1. Bracket'lar DB'de tutulur (shipping_rate_brackets)
 *   2. refreshKargolabBase() → her bracket için KargoLab fiyatı çek
 *   3. recalcPrice() → margin uygula (kargolab_base × (1 + margin_pct/100) + margin_flat)
 *   4. pushToShopify() → Shopify Domestic zone'a DeliveryMethodDefinition oluştur/güncelle
 *
 * Multi-channel: aynı bracket data WooCommerce/Trendyol push'a da kullanılabilir.
 */
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { shippingRateBrackets, shopifyConnections } from '@/db/schema';
import { quoteShipmentRate } from '@/lib/kargolab/rates';
import { shopifyGraphQL } from '@/lib/shopify/client';

export interface BracketCalcInput {
  weightLowGrams: number;
  weightHighGrams: number;
  marginPct: number;
  marginFlatCents: bigint | number;
  kargolabBaseCents: bigint | number | null;
}

/** Margin uygulayarak final satış fiyatını hesaplar. */
export function calcPriceCents(input: BracketCalcInput): number {
  const base = Number(input.kargolabBaseCents ?? 0);
  if (base <= 0) return 0;
  const withPct = Math.round(base * (1 + input.marginPct / 100));
  return withPct + Number(input.marginFlatCents ?? 0);
}

interface RefreshOk {
  ok: true;
  refreshed: number;
  failed: number;
  details: Array<{
    bracketId: string;
    name: string;
    oldBaseCents: number | null;
    newBaseCents: number;
    courier: string;
  }>;
}
interface RefreshErr {
  ok: false;
  error: string;
}

/**
 * Her aktif bracket için KargoLab fiyatını çek, base + price'ı güncelle.
 *
 * Ağırlık olarak bracket'ın ORTA noktasını kullanır (örn. 0-3 kg → 1.5 kg sorgulanır).
 */
export async function refreshKargolabBase(): Promise<RefreshOk | RefreshErr> {
  const brackets = await db
    .select()
    .from(shippingRateBrackets)
    .where(eq(shippingRateBrackets.countryCode, 'TR'))
    .orderBy(asc(shippingRateBrackets.sortOrder));

  if (brackets.length === 0) {
    return { ok: false, error: 'Tanımlı bracket yok' };
  }

  const details: RefreshOk['details'] = [];
  let refreshed = 0;
  let failed = 0;

  for (const b of brackets) {
    // Bracket'in ortasını kullan
    const midGrams = Math.round((b.weightLowGrams + b.weightHighGrams) / 2);
    const quote = await quoteShipmentRate({
      weightGrams: midGrams,
      fromProvince: process.env.WAREHOUSE_PROVINCE ?? 'İstanbul',
      fromDistrict: process.env.WAREHOUSE_DISTRICT ?? 'Kadıköy',
      toProvince: 'Ankara',
      toDistrict: 'Çankaya',
    });

    if (!quote.ok) {
      failed++;
      continue;
    }

    const c = quote.cheapest;
    const newPriceCents = calcPriceCents({
      weightLowGrams: b.weightLowGrams,
      weightHighGrams: b.weightHighGrams,
      marginPct: b.marginPct,
      marginFlatCents: b.marginFlatCents ?? 0n,
      kargolabBaseCents: c.priceCents,
    });

    await db
      .update(shippingRateBrackets)
      .set({
        kargolabBaseCents: BigInt(c.priceCents),
        kargolabCourier: c.courrierName,
        kargolabFetchedAt: { at: new Date().toISOString() },
        priceCents: BigInt(newPriceCents),
        updatedAt: new Date(),
      })
      .where(eq(shippingRateBrackets.id, b.id));

    details.push({
      bracketId: b.id,
      name: b.name,
      oldBaseCents: b.kargolabBaseCents != null ? Number(b.kargolabBaseCents) : null,
      newBaseCents: c.priceCents,
      courier: c.courrierName,
    });
    refreshed++;
  }

  return { ok: true, refreshed, failed, details };
}

/**
 * Tüm aktif bracket'ları Shopify Domestic zone'a publish et.
 * Mevcut methodları tarayıp shopify_method_id ile eşleştir, yoksa oluştur, varsa update et.
 */
interface PushOk {
  ok: true;
  created: number;
  updated: number;
  deletedOrphans: number;
}
interface PushErr {
  ok: false;
  error: string;
}

const FIND_PROFILE = /* GraphQL */ `
  query {
    deliveryProfiles(first: 1) {
      edges {
        node {
          id
          profileLocationGroups {
            locationGroup { id }
            locationGroupZones(first: 10) {
              edges {
                node {
                  zone {
                    id
                    countries { code { countryCode } }
                  }
                  methodDefinitions(first: 50) {
                    edges {
                      node {
                        id
                        name
                        active
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const DELIVERY_PROFILE_UPDATE = /* GraphQL */ `
  mutation deliveryProfileUpdate($id: ID!, $profile: DeliveryProfileInput!) {
    deliveryProfileUpdate(id: $id, profile: $profile) {
      profile { id }
      userErrors { field message }
    }
  }
`;

interface FindProfileResp {
  deliveryProfiles: {
    edges: Array<{
      node: {
        id: string;
        profileLocationGroups: Array<{
          locationGroup: { id: string };
          locationGroupZones: {
            edges: Array<{
              node: {
                zone: {
                  id: string;
                  countries: Array<{ code: { countryCode: string } }>;
                };
                methodDefinitions: {
                  edges: Array<{ node: { id: string; name: string; active: boolean } }>;
                };
              };
            }>;
          };
        }>;
      };
    }>;
  };
}

export async function pushBracketsToShopify(): Promise<PushOk | PushErr> {
  // 1) Connected store var mı?
  const [conn] = await db
    .select()
    .from(shopifyConnections)
    .where(isNull(shopifyConnections.uninstalledAt))
    .limit(1);
  if (!conn) {
    return { ok: false, error: 'Aktif Shopify bağlantısı yok' };
  }

  // 2) Profile + Domestic zone bul
  let profileResp: FindProfileResp;
  try {
    profileResp = await shopifyGraphQL<FindProfileResp>(FIND_PROFILE);
  } catch (err) {
    return { ok: false, error: `Shopify GraphQL fail: ${err instanceof Error ? err.message : 'unknown'}` };
  }

  const profile = profileResp.deliveryProfiles.edges[0]?.node;
  if (!profile) return { ok: false, error: 'Delivery profile bulunamadı' };

  const locationGroup = profile.profileLocationGroups[0];
  if (!locationGroup) return { ok: false, error: 'Location group bulunamadı' };

  const domesticZoneEdge = locationGroup.locationGroupZones.edges.find((e) =>
    e.node.zone.countries.some((c) => c.code.countryCode === 'TR'),
  );
  if (!domesticZoneEdge) return { ok: false, error: 'TR (Domestic) zone bulunamadı' };
  const zoneId = domesticZoneEdge.node.zone.id;
  const existingMethods = domesticZoneEdge.node.methodDefinitions.edges.map((e) => e.node);

  // 3) Aktif bracket'ları al
  const brackets = await db
    .select()
    .from(shippingRateBrackets)
    .where(
      and(
        eq(shippingRateBrackets.status, 'active'),
        eq(shippingRateBrackets.countryCode, 'TR'),
        isNotNull(shippingRateBrackets.priceCents),
      ),
    )
    .orderBy(asc(shippingRateBrackets.sortOrder));

  if (brackets.length === 0) {
    return { ok: false, error: 'Aktif TR bracket yok' };
  }

  // 4) Mevcut method ID'lerini tara
  const ourBracketIds = new Set(
    brackets.map((b) => b.shopifyMethodId).filter(Boolean) as string[],
  );

  // Bracketin shopify_method_id'si yoksa CREATE; varsa zaten var, atla (delete+create politikası daha basit)
  const methodsToCreate = brackets.map((b) => ({
    name: b.name,
    active: b.status === 'active',
    rateDefinition: {
      price: { amount: (Number(b.priceCents) / 100).toFixed(2), currencyCode: 'TRY' },
    },
    weightConditionsToCreate: [
      {
        operator: 'GREATER_THAN_OR_EQUAL_TO',
        criteria: { value: b.weightLowGrams / 1000, unit: 'KILOGRAMS' },
      },
      {
        operator: 'LESS_THAN_OR_EQUAL_TO',
        criteria: { value: b.weightHighGrams / 1000, unit: 'KILOGRAMS' },
      },
    ],
  }));

  // 5) Önce Shopify'da kayıtlı bizim eski bracket'ları sil (orphan cleanup)
  const orphansToDelete = existingMethods
    .filter((m) => ourBracketIds.has(m.id))
    .map((m) => m.id);

  // Ayrıca isim "Standart Kargo (X-Y kg)" formatındaki tüm methodları temizle — re-sync sertligi için
  const namedOrphans = existingMethods
    .filter((m) => /Standart Kargo \(\d+/.test(m.name))
    .map((m) => m.id);
  const allOrphans = Array.from(new Set([...orphansToDelete, ...namedOrphans]));

  try {
    await shopifyGraphQL(DELIVERY_PROFILE_UPDATE, {
      id: profile.id,
      profile: {
        ...(allOrphans.length > 0 ? { methodDefinitionsToDelete: allOrphans } : {}),
        locationGroupsToUpdate: [
          {
            id: locationGroup.locationGroup.id,
            zonesToUpdate: [{ id: zoneId, methodDefinitionsToCreate: methodsToCreate }],
          },
        ],
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: `Shopify push fail: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }

  // 6) DB'de shopifyPushedAt güncelle
  const now = new Date();
  for (const b of brackets) {
    await db
      .update(shippingRateBrackets)
      .set({ shopifyPushedAt: { at: now.toISOString() }, updatedAt: now })
      .where(eq(shippingRateBrackets.id, b.id));
  }

  return {
    ok: true,
    created: brackets.length,
    updated: 0,
    deletedOrphans: allOrphans.length,
  };
}
