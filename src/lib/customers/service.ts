/**
 * Müşteri (customers + customer_addresses) servis katmanı — FAZ 1.
 *
 * Tek doğruluk noktası: order-ingest dual-write (C1), checkout adres dual-write (C2),
 * müşteri kaydı (D1) ve portal adres CRUD (E) buradaki fonksiyonları kullanır.
 * Hepsi EMAIL köprüsü + best-effort (çağıran akışı bozmaz).
 */
import { type AnyColumn, and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers, customerAddresses } from '@/db/schema';

const norm = (s?: string | null): string => (s ?? '').trim().toLocaleLowerCase('tr');

export interface UpsertCustomerInput {
  email: string;
  shopifyCustomerId?: string | null;
  name?: string | null;
  phone?: string | null;
  userId?: string | null;
}

/**
 * Email ile müşteri upsert (idempotent). Mevcut shopifyCustomerId/userId KORUNUR (coalesce),
 * boşsa yenisi yazılır. Best-effort: hata olursa null döner, çağıranı bozmaz.
 */
export async function upsertCustomerByEmail(input: UpsertCustomerInput): Promise<string | null> {
  const email = norm(input.email);
  if (!email) return null;
  try {
    const [row] = await db
      .insert(customers)
      .values({
        email,
        shopifyCustomerId: input.shopifyCustomerId ?? null,
        name: input.name ?? null,
        phone: input.phone ?? null,
        userId: input.userId ?? null,
      })
      .onConflictDoUpdate({
        target: customers.email,
        set: {
          shopifyCustomerId: sql`coalesce(${customers.shopifyCustomerId}, excluded.shopify_customer_id)`,
          userId: sql`coalesce(${customers.userId}, excluded.user_id)`,
          name: sql`coalesce(excluded.name, ${customers.name})`,
          phone: sql`coalesce(excluded.phone, ${customers.phone})`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: customers.id });
    return row?.id ?? null;
  } catch (e) {
    console.error('[customers] upsertByEmail failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** shopifyCustomerId veya email ile RDS müşteri id'sini bul. */
export async function findCustomerId(opts: {
  shopifyCustomerId?: string | null;
  email?: string | null;
}): Promise<string | null> {
  try {
    if (opts.shopifyCustomerId) {
      const [r] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.shopifyCustomerId, String(opts.shopifyCustomerId)))
        .limit(1);
      if (r) return r.id;
    }
    const email = norm(opts.email);
    if (email) {
      const [r] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.email, email))
        .limit(1);
      if (r) return r.id;
    }
  } catch (e) {
    console.error('[customers] findCustomerId failed:', e instanceof Error ? e.message : e);
  }
  return null;
}

export interface RdsAddressInput {
  customerId: string;
  label?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  province?: string | null; // il
  district?: string | null; // ilçe
  neighborhood?: string | null; // mahalle
  address1?: string | null;
  postalCode?: string | null;
  isDefault?: boolean;
  shopifyAddressId?: string | null;
}

// null-safe eşitlik (dedup): NULL = NULL true döner
const eqND = (col: AnyColumn, val: string | null | undefined) =>
  sql`${col} IS NOT DISTINCT FROM ${val ?? null}`;

/**
 * Görüntü-katmanı adres dedup'ı — aynı açık adres+ilçe+il'den yalnız İLKİ kalır
 * (liste default-önce/yeni-önce sıralı geldiğinden varsayılan/en güncel korunur).
 * Eski duplicate DB kayıtları storefront köprüsünde tekilleştirmek için.
 */
export function dedupeAddressRows<
  T extends { address1: string | null; district: string | null; province: string | null },
>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = [r.address1, r.district, r.province]
      .map((s) => (s ?? '').trim().toLocaleLowerCase('tr-TR'))
      .join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * RDS adres upsert — null-safe dedup: aynı AÇIK ADRES + İLÇE + İL = AYNI adres
 * (mahalle/posta/telefon farkı yeni kayıt üretmez — sipariş başına duplicate
 * birikmesin; eşleşmede bu alanlar en güncel değerle GÜNCELLENİR).
 * Varsa shopifyAddressId'yi günceller; yoksa ekler. isDefault verilmezse: müşterinin ilk
 * adresi otomatik default olur. isDefault=true ise diğerlerinin default'u kaldırılır.
 * Best-effort. Eklenen/var olan adresin id'sini döner.
 */
export async function upsertCustomerAddressRds(input: RdsAddressInput): Promise<string | null> {
  try {
    const existingMatch = await db
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(
        and(
          eq(customerAddresses.customerId, input.customerId),
          eqND(customerAddresses.address1, input.address1),
          eqND(customerAddresses.district, input.district),
          eqND(customerAddresses.province, input.province),
        ),
      )
      .limit(1);

    if (existingMatch[0]) {
      await db
        .update(customerAddresses)
        .set({
          // en güncel bilgiyle tazele (yeni değer yoksa mevcut kalsın)
          neighborhood: input.neighborhood ?? sql`${customerAddresses.neighborhood}`,
          postalCode: input.postalCode ?? sql`${customerAddresses.postalCode}`,
          phone: input.phone ?? sql`${customerAddresses.phone}`,
          firstName: input.firstName ?? sql`${customerAddresses.firstName}`,
          lastName: input.lastName ?? sql`${customerAddresses.lastName}`,
          shopifyAddressId: input.shopifyAddressId ?? sql`${customerAddresses.shopifyAddressId}`,
          updatedAt: new Date(),
        })
        .where(eq(customerAddresses.id, existingMatch[0].id));
      return existingMatch[0].id;
    }

    const existingCount = await db
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, input.customerId))
      .limit(1);
    const makeDefault = input.isDefault ?? existingCount.length === 0;

    if (makeDefault) {
      await db
        .update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.customerId, input.customerId));
    }

    const [row] = await db
      .insert(customerAddresses)
      .values({
        customerId: input.customerId,
        label: input.label ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        province: input.province ?? null,
        district: input.district ?? null,
        neighborhood: input.neighborhood ?? null,
        address1: input.address1 ?? null,
        postalCode: input.postalCode ?? null,
        isDefault: makeDefault,
        shopifyAddressId: input.shopifyAddressId ?? null,
      })
      .returning({ id: customerAddresses.id });
    return row?.id ?? null;
  } catch (e) {
    console.error('[customers] upsertAddressRds failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
