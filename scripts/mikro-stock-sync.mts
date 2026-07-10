/**
 * Mikro → Shopify stok senkronizasyonu (tekrarlayan job).
 *
 * Mikro depo 60 (ViaDolapdere = ara depo sevkiyat) gerçek stoğunu çeker → Shopify
 * envanterine mutlak değer olarak yazar. Böylece Shopify'daki "100 placeholder"
 * yerine gerçek stok görünür → oversell riski kalkar.
 *
 * SKU eşleme  : Shopify SKU = Mikro sto_kod'dan VIA prefix çıkarılmış hali (VIA100 → 100).
 * Çakışma koruması: Shopify başlığı ↔ Mikro adı benzerliği düşükse (aynı SKU farklı ürün)
 *                   o ürün ATLANIR — yanlış stok yazmaz. Bundle (ASR-xxxx) adları güvenilir sayılır.
 * Durum       : ACTIVE + DRAFT senkronlanır; ARCHIVED'e dokunulmaz.
 * Yön         : tek yönlü Mikro → Shopify (Mikro kaynak). Shopify'da olup Mikro'da olmayan → dokunulmaz.
 *
 * Kullanım:
 *   npx tsx scripts/mikro-stock-sync.mts            # DRY-RUN (yazmaz, sadece rapor)
 *   npx tsx scripts/mikro-stock-sync.mts --apply    # canlı Shopify envanterine YAZAR
 *
 * Sunucu cron (her 2 saatte bir, örnek):
 *   0 *\/2 * * * cd /opt/vendor-platform && npx tsx scripts/mikro-stock-sync.mts --apply >> /var/log/stock-sync.log 2>&1
 *
 * Gerekli env (.env.local veya process.env):
 *   MIKRO_API_URL, MIKRO_USERNAME, MIKRO_PASSWORD, SHOPIFY_ADMIN_ACCESS_TOKEN
 *   (opsiyonel: MIKRO_STOK_PREFIX=VIA, MIKRO_STOCK_DEPO=60, SHOPIFY_SHOP_DOMAIN)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------- env yükle (process.env öncelikli, .env.local fallback) ----------
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  for (const f of ['.env.local', '.env']) {
    try {
      const txt = readFileSync(resolve(process.cwd(), f), 'utf8');
      for (const line of txt.split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m && (env[m[1]] === undefined || env[m[1]] === '')) {
          env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      /* dosya yoksa geç */
    }
  }
  return env;
}

const env = loadEnv();
const APPLY = process.argv.includes('--apply');

const MIKRO_URL = (env.MIKRO_API_URL || '').replace(/\/$/, '');
const MIKRO_USER = env.MIKRO_USERNAME || '';
const MIKRO_PASS = env.MIKRO_PASSWORD || '';
const PREFIX = (env.MIKRO_STOK_PREFIX || 'VIA').toUpperCase();
const DEPO = Number(env.MIKRO_STOCK_DEPO || 60);
const SHOP = env.SHOPIFY_SHOP_DOMAIN || 'via-mood.myshopify.com';
const SHTOK = env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';
const API = '2025-01';

if (!MIKRO_URL || !MIKRO_USER || !MIKRO_PASS || !SHTOK) {
  console.error('❌ Eksik env: MIKRO_API_URL / MIKRO_USERNAME / MIKRO_PASSWORD / SHOPIFY_ADMIN_ACCESS_TOKEN');
  process.exit(1);
}

// ---------- Mikro ----------
async function mikroLogin(): Promise<string> {
  const res = await fetch(`${MIKRO_URL}/Login/Authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Username: MIKRO_USER, Password: MIKRO_PASS }),
  });
  if (!res.ok) throw new Error(`Mikro login ${res.status}: ${await res.text()}`);
  const token = (await res.text()).trim().replace(/^"|"$/g, '');
  if (!token.startsWith('ey')) throw new Error('Mikro: beklenmedik token formatı');
  return token;
}

async function mikroQuery<T = Record<string, unknown>>(token: string, sql: string): Promise<T[]> {
  const res = await fetch(`${MIKRO_URL}/MikroV17/sqlverioku`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ Query: sql }),
  });
  if (!res.ok) throw new Error(`Mikro sqlverioku ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { IsSuccess?: boolean; ErrorMessage?: string; Result?: T[] };
  if (data.IsSuccess === false) throw new Error(`Mikro sorgu hatası: ${data.ErrorMessage}`);
  return data.Result || [];
}

/** Depo stoğu: { shopifySku → qty }. VIA prefix çıkarılır. */
async function fetchMikroStock(token: string): Promise<Map<string, number>> {
  const rows = await mikroQuery<{ sto_kod: string; Q: number }>(
    token,
    `SELECT s.sto_kod, dbo.fn_DepodakiMiktar(s.sto_kod, ${DEPO}, GETDATE()) AS Q ` +
      `FROM STOKLAR s WHERE s.sto_kod LIKE '${PREFIX}%'`,
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    const code = String(r.sto_kod || '').toUpperCase();
    if (!code.startsWith(PREFIX)) continue;
    const sku = code.slice(PREFIX.length);
    const q = Math.max(0, Math.round(Number(r.Q) || 0));
    if (sku) map.set(sku, q);
  }
  return map;
}

/** Mikro ürün adları (çakışma doğrulaması için): { shopifySku → sto_isim }. */
async function fetchMikroNames(token: string, skus: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < skus.length; i += 120) {
    const inList = skus.slice(i, i + 120).map((s) => `'${PREFIX}${s.replace(/'/g, "''")}'`).join(',');
    const rows = await mikroQuery<{ sto_kod: string; sto_isim: string }>(
      token,
      `SELECT sto_kod, sto_isim FROM STOKLAR WHERE sto_kod IN (${inList})`,
    );
    for (const r of rows) map.set(String(r.sto_kod).slice(PREFIX.length).toUpperCase(), r.sto_isim || '');
  }
  return map;
}

// ---------- Shopify ----------
async function shopifyGQL<T = unknown>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://${SHOP}/admin/api/${API}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHTOK },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(`Shopify GraphQL: ${JSON.stringify(json.errors).slice(0, 300)}`);
  return json.data as T;
}

interface ShopVariant {
  sku: string;
  status: string;
  title: string;
  qty: number;
  invItem: string;
}

async function fetchShopify(): Promise<{ location: string; variants: ShopVariant[] }> {
  const locData = await shopifyGQL<{ locations: { nodes: { id: string; isActive: boolean }[] } }>(
    '{ locations(first:5){ nodes{ id isActive } } }',
  );
  const active = locData.locations.nodes.find((l) => l.isActive) || locData.locations.nodes[0];
  const location = active.id;

  const Q = `query($c:String){ products(first:200, after:$c){ pageInfo{hasNextPage endCursor}
    nodes{ title status variants(first:25){ nodes{ sku inventoryQuantity inventoryItem{ id } } } } } }`;
  const variants: ShopVariant[] = [];
  let cursor: string | null = null;
  do {
    const d: { products: { pageInfo: { hasNextPage: boolean; endCursor: string };
      nodes: { title: string; status: string;
        variants: { nodes: { sku: string | null; inventoryQuantity: number; inventoryItem: { id: string } }[] } }[] } } =
      await shopifyGQL(Q, { c: cursor });
    for (const p of d.products.nodes) {
      for (const v of p.variants.nodes) {
        if (v.sku) variants.push({
          sku: v.sku.trim(), status: p.status, title: p.title,
          qty: v.inventoryQuantity, invItem: v.inventoryItem.id.split('/').pop() as string,
        });
      }
    }
    cursor = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
  } while (cursor);
  return { location, variants };
}

// ---------- İsim benzerliği (Türkçe-normalize Jaccard) ----------
function tokset(t: string): Set<string> {
  let s = (t || '').toLowerCase();
  for (const [a, b] of [['ı', 'i'], ['ş', 's'], ['ç', 'c'], ['ğ', 'g'], ['ü', 'u'], ['ö', 'o'], ['â', 'a'], ['î', 'i']]) {
    s = s.split(a).join(b);
  }
  return new Set(s.match(/[0-9a-z]+/g) || []);
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ---------- inventorySetQuantities (batch) ----------
const INVENTORY_SET = `mutation($input:InventorySetQuantitiesInput!){
  inventorySetQuantities(input:$input){ userErrors{ field message } } }`;

async function writeInventory(location: string, items: { invItem: string; qty: number }[]): Promise<number> {
  let ok = 0;
  for (let i = 0; i < items.length; i += 100) {
    const batch = items.slice(i, i + 100);
    const d = await shopifyGQL<{ inventorySetQuantities: { userErrors: { message: string }[] } }>(INVENTORY_SET, {
      input: {
        name: 'available',
        reason: 'correction',
        referenceDocumentUri: 'viamood://mikro-stock-sync',
        // compareQuantity:null artık reddediliyor → ignoreCompareQuantity ile compare check atlanır
        ignoreCompareQuantity: true,
        quantities: batch.map((b) => ({
          inventoryItemId: `gid://shopify/InventoryItem/${b.invItem}`,
          locationId: location,
          quantity: b.qty,
        })),
      },
    });
    const errs = d.inventorySetQuantities.userErrors;
    if (errs.length) console.error(`  batch ${i / 100 + 1} HATA: ${JSON.stringify(errs).slice(0, 200)}`);
    else ok += batch.length;
    await new Promise((r) => setTimeout(r, 400));
  }
  return ok;
}

// ---------- main ----------
async function main() {
  console.log(`\n🔄 Mikro→Shopify stok sync ${APPLY ? '(APPLY — canlı yazım)' : '(DRY-RUN — yazmaz)'} | depo ${DEPO}`);
  const token = await mikroLogin();
  const [mikro, shop] = await Promise.all([fetchMikroStock(token), fetchShopify()]);
  console.log(`   Mikro: ${mikro.size} ${PREFIX} SKU | Shopify: ${shop.variants.length} SKU'lu variant`);

  // eşleşen SKU'ların Mikro adlarını çek (çakışma doğrulaması)
  const shopBySku = new Map<string, ShopVariant>();
  for (const v of shop.variants) if (!shopBySku.has(v.sku.toUpperCase())) shopBySku.set(v.sku.toUpperCase(), v);
  const candidates = [...mikro.keys()].filter((s) => shopBySku.has(s.toUpperCase()));
  const names = await fetchMikroNames(token, candidates);

  const toWrite: { invItem: string; qty: number }[] = [];
  const changes: { sku: string; from: number; to: number; status: string }[] = [];
  let skippedArchived = 0, mismatch = 0, unchanged = 0;
  const mismatches: string[] = [];

  for (const sku of candidates) {
    const v = shopBySku.get(sku.toUpperCase())!;
    const qty = mikro.get(sku)!;
    if (v.status === 'ARCHIVED') { skippedArchived++; continue; }
    // çakışma koruması: bundle kodu (ASR-...) güvenilir; değilse isim benzerliği ≥0.34 şart
    const mkName = names.get(sku.toUpperCase()) || '';
    const trusted = /^\s*ASR-?\d/i.test(mkName) || jaccard(tokset(v.title), tokset(mkName)) >= 0.34;
    if (!trusted) { mismatch++; mismatches.push(`${sku} (SH:"${v.title.slice(0, 24)}" ≠ MK:"${mkName.slice(0, 24)}")`); continue; }
    if (v.qty === qty) { unchanged++; continue; }
    toWrite.push({ invItem: v.invItem, qty });
    changes.push({ sku, from: v.qty, to: qty, status: v.status });
  }

  const risky = changes.filter((c) => c.from >= 50 && c.to < 20).length;
  console.log(`   Değişecek: ${changes.length} | değişmeyen: ${unchanged} | çakışma-atlandı: ${mismatch} | arşiv-atlandı: ${skippedArchived}`);
  console.log(`   ⚠ Oversell düzeltmesi (50+ → <20): ${risky} ürün`);
  if (mismatches.length) console.log(`   ⛔ Çakışmalar (dokunulmadı): ${mismatches.join('; ').slice(0, 300)}`);

  if (!APPLY) {
    console.log('\n   Örnek değişiklikler (ilk 15):');
    for (const c of changes.slice(0, 15)) console.log(`     SKU ${c.sku} [${c.status}] ${c.from} → ${c.to}`);
    console.log(`\n   DRY-RUN bitti. Yazmak için: npx tsx scripts/mikro-stock-sync.mts --apply\n`);
    return;
  }
  const written = await writeInventory(shop.location, toWrite);
  console.log(`\n✅ TAMAM: ${written}/${toWrite.length} ürün Mikro gerçek stoğuna çekildi.\n`);
}

main().catch((e) => { console.error('❌ Sync hatası:', e); process.exit(1); });
