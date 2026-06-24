/**
 * FAZ 1 — orders → customers + customer_addresses backfill.
 *
 * `orders` tablosundaki geçmiş siparişlerden (email köprüsü) müşteri kayıtlarını türetir.
 * Idempotent: customers email UNIQUE (onConflictDoUpdate); adres tohumlama "müşterinin
 * adresi yoksa 1 default adres ekle" mantığı (tekrar çalıştırmada atlar).
 *
 * ⚠️ il/ilçe TERS eşleme (order-ingest.ts:187-188): orders.shippingAddress.district = il,
 *    .city = ilçe, .address2 = mahalle. customer_addresses'e düzgün isimle yazılır.
 *
 * Kullanım (sunucuda, repo kökünden):
 *   set -a && source .env.production && set +a
 *   ./node_modules/.bin/tsx scripts/backfill-customers.mts --dry   # sadece say, yazma
 *   ./node_modules/.bin/tsx scripts/backfill-customers.mts         # gerçek
 *
 * NOT: schema/db tabloları DİNAMİK import edilir. tsx altında statik named import, cjs-module-lexer
 * `export *` zincirini eksik algıladığı için "does not provide export" link hatası veriyor;
 * dinamik import() bu doğrulamayı atlayıp canlı değerleri döndürür (probe ile doğrulandı).
 */
import { desc, eq, isNotNull, sql } from 'drizzle-orm';

const { db } = await import('@/db/client');
const { customers, customerAddresses, orders } = await import('@/db/schema');

const norm = (s?: string | null): string => (s ?? '').trim().toLocaleLowerCase('tr');

type ShipAddr = {
  name?: string;
  phone?: string;
  address1?: string;
  address2?: string; // mahalle
  city?: string; // ilçe
  district?: string; // il (order-ingest: shipping_address.province → district)
  postalCode?: string;
};

type Seed = {
  email: string;
  shopifyCustomerId: string | null;
  name: string | null;
  phone: string | null;
  ship: ShipAddr | null;
};

async function main() {
  const dry = process.argv.includes('--dry');
  console.log(dry ? '— DRY RUN (yazma yok) —' : '— BACKFILL —');

  // Email'i olan tüm siparişleri en yeni → en eski sırada çek; email başına ilk (en güncel) kazanır.
  const rows = await db
    .select({
      customerId: orders.customerId,
      email: orders.customerEmail,
      name: orders.customerName,
      phone: orders.customerPhone,
      ship: orders.shippingAddress,
    })
    .from(orders)
    .where(isNotNull(orders.customerEmail))
    .orderBy(desc(orders.placedAt));

  const byEmail = new Map<string, Seed>();
  for (const r of rows) {
    const email = norm(r.email);
    if (!email) continue;
    if (byEmail.has(email)) continue; // en güncel zaten alındı
    byEmail.set(email, {
      email,
      shopifyCustomerId: r.customerId ? String(r.customerId) : null,
      name: r.name ?? null,
      phone: r.phone ?? null,
      ship: (r.ship as ShipAddr | null) ?? null,
    });
  }

  const seeds = [...byEmail.values()];
  console.log(`${rows.length} sipariş → ${seeds.length} benzersiz müşteri (email).`);

  if (dry) {
    const existing = await db.select({ email: customers.email }).from(customers);
    const existingSet = new Set(existing.map((e) => norm(e.email)));
    const willCreate = seeds.filter((s) => !existingSet.has(s.email)).length;
    const willUpdate = seeds.length - willCreate;
    const withAddr = seeds.filter((s) => s.ship?.address1).length;
    console.log(
      JSON.stringify(
        { uniqueCustomers: seeds.length, willCreate, willUpdate, seedableAddresses: withAddr },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  let created = 0;
  let updated = 0;
  let addrSeeded = 0;

  for (const s of seeds) {
    const [row] = await db
      .insert(customers)
      .values({
        email: s.email,
        shopifyCustomerId: s.shopifyCustomerId,
        name: s.name,
        phone: s.phone,
      })
      .onConflictDoUpdate({
        target: customers.email,
        set: {
          // mevcut shopifyId'yi kaybetme; yoksa yeniyi yaz
          shopifyCustomerId: sql`coalesce(${customers.shopifyCustomerId}, excluded.shopify_customer_id)`,
          name: sql`coalesce(excluded.name, ${customers.name})`,
          phone: sql`coalesce(excluded.phone, ${customers.phone})`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: customers.id, createdAt: customers.createdAt, updatedAt: customers.updatedAt });

    if (!row) continue;
    // createdAt == updatedAt → yeni eklendi (yaklaşık ayrım)
    if (row.createdAt.getTime() === row.updatedAt.getTime()) created++;
    else updated++;

    // Adres tohumla — sadece müşterinin HİÇ adresi yoksa (idempotent).
    if (s.ship?.address1) {
      const has = await db
        .select({ id: customerAddresses.id })
        .from(customerAddresses)
        .where(eq(customerAddresses.customerId, row.id))
        .limit(1);
      if (has.length === 0) {
        const nameParts = (s.ship.name ?? s.name ?? '').trim().split(/\s+/).filter(Boolean);
        await db.insert(customerAddresses).values({
          customerId: row.id,
          firstName: nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] || null,
          lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : null,
          phone: s.ship.phone ?? s.phone ?? null,
          // ⚠️ TERS eşleme: orders.shippingAddress.district = il, .city = ilçe, .address2 = mahalle
          province: s.ship.district ?? null,
          district: s.ship.city ?? null,
          neighborhood: s.ship.address2 ?? null,
          address1: s.ship.address1 ?? null,
          postalCode: s.ship.postalCode ?? null,
          isDefault: true,
        });
        addrSeeded++;
      }
    }
  }

  console.log('\nBİTTİ →', JSON.stringify({ created, updated, addrSeeded }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
