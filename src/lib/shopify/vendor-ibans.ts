/**
 * Sepetteki line item'ların tedarikçi(ler)ini çözüp havale IBAN bilgilerini döndürür.
 *
 * Per-vendor havale modeli: her tedarikçi kendi banka hesabına gelen ödemeyi onaylar.
 * Via Mood'un kendi ürünleri → tedarikçisi "Via Mood" → admin onaylar.
 *
 * Çok-tedarikçili sepette her tedarikçinin IBAN'ı + kendi tutarı ayrı döner.
 * Tek tedarikçi varsa kargo da onun tutarına eklenir.
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { productVariants, vendors } from '@/db/schema';

export interface VendorBank {
  vendorId: string;
  name: string;
  iban?: string;
  account_holder?: string;
  bank?: string;
  amount: number; // TL — bu tedarikçiye gönderilecek tutar
}

export async function resolveVendorIbans(
  lineItems: Array<{ variant_id: number; quantity: number }>,
  shippingTl: number,
): Promise<VendorBank[]> {
  const variantIds = lineItems.map((li) => String(li.variant_id)).filter(Boolean);
  if (!variantIds.length) return [];

  const rows = await db
    .select({
      shopifyVariantId: productVariants.shopifyVariantId,
      priceCents: productVariants.priceCents,
      vendorId: productVariants.vendorId,
      vname: vendors.name,
      iban: vendors.iban,
      holder: vendors.accountHolderName,
      bank: vendors.bankName,
    })
    .from(productVariants)
    .leftJoin(vendors, eq(vendors.id, productVariants.vendorId))
    .where(inArray(productVariants.shopifyVariantId, variantIds));

  const byVariant = new Map(rows.map((r) => [r.shopifyVariantId, r]));
  const acc = new Map<string, VendorBank>();

  for (const li of lineItems) {
    const r = byVariant.get(String(li.variant_id));
    if (!r || !r.vendorId) continue;
    const lineTl = (Number(r.priceCents ?? 0) / 100) * li.quantity;
    const cur =
      acc.get(r.vendorId) ??
      {
        vendorId: r.vendorId,
        name: r.vname ?? 'Via Mood',
        iban: r.iban ?? undefined,
        account_holder: r.holder ?? undefined,
        bank: r.bank ?? undefined,
        amount: 0,
      };
    cur.amount += lineTl;
    acc.set(r.vendorId, cur);
  }

  const list = Array.from(acc.values());
  // Kargoyu ilk tedarikçinin tutarına ekle (tek tedarikçili sepette = grand total)
  const firstVendor = list[0];
  if (firstVendor && shippingTl > 0) firstVendor.amount += shippingTl;
  list.forEach((v) => (v.amount = Math.round(v.amount * 100) / 100));
  return list;
}
