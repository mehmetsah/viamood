/**
 * Trendyol → Via Mood ürün çekimi (FAZ 2 test harness).
 *
 * Canlı Trendyol Product Integration API'sinden bir satıcının ürünlerini çeker,
 * örnek çıktı + istatistik basar ve isteğe bağlı JSON örneği yazar.
 * SALT-OKUMA: Shopify/DB/hiçbir yere yazmaz — sadece Trendyol'dan okur ve rapor üretir.
 *
 * NOT: Bu script tsx altında ESM→CJS interop gotcha'sından kaçınmak için SELF-CONTAINED'dir
 * (repo konvansiyonu; bkz. scripts/mikro-stock-sync.mts). ÜRETİM normalize/istemci mantığı
 * src/lib/trendyol/ altındadır (Next uygulaması onu kullanır, birim testleri vardır) —
 * bu harness yalnızca hızlı görsel doğrulama içindir.
 *
 * Kullanım:
 *   npx tsx scripts/trendyol-pull.mts                       # ilk 20 ürünü göster
 *   npx tsx scripts/trendyol-pull.mts --limit 50            # ilk 50 göster
 *   npx tsx scripts/trendyol-pull.mts --approved            # sadece onaylı ürünler
 *   npx tsx scripts/trendyol-pull.mts --out faz2-ornek.json # örneği dosyaya yaz
 *
 * Gerekli env (.env.local veya process.env):
 *   TRENDYOL_SUPPLIER_ID, TRENDYOL_API_KEY, TRENDYOL_SECRET_KEY
 *   (member_id=30 KargoLab Trendyol mağazasının entegrasyon bilgileri —
 *    KargoLab prod DB'sinde: integration_api_keys. Bu makinede yok.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
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

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// ---------- Trendyol Product API (harness kopyası; üretim: src/lib/trendyol) ----------
const PRODUCT_API_BASE = 'https://apigw.trendyol.com/integration/product/sellers';

interface Row {
  [k: string]: unknown;
}

interface DisplayItem {
  barcode: string;
  title: string;
  brand: string;
  category: string;
  quantity: number;
  listPrice: number | null;
  salePrice: number | null;
  approved: boolean;
  images: string[];
}

function s(v: unknown): string {
  return v == null ? '' : String(v).trim();
}
function firstNonEmpty(...vals: unknown[]): string {
  for (const v of vals) {
    const t = s(v);
    if (t) return t;
  }
  return '';
}
function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(row: Row): DisplayItem {
  const brand =
    row.brand && typeof row.brand === 'object'
      ? s((row.brand as { name?: string }).name)
      : firstNonEmpty(row.brandName, row.brand);
  const category =
    row.category && typeof row.category === 'object'
      ? s((row.category as { name?: string }).name)
      : firstNonEmpty(row.categoryName, row.pimCategoryName);
  const images: string[] = [];
  if (Array.isArray(row.images)) {
    for (const im of row.images) {
      const u = typeof im === 'string' ? im.trim() : firstNonEmpty((im as Row)?.url, (im as Row)?.imageUrl, (im as Row)?.originalUrl);
      if (u) images.push(u);
    }
  }
  const q = num(row.quantity ?? row.stockAmount ?? row.stock);
  return {
    barcode: firstNonEmpty(row.barcode, row.ean, row.gtin, row.upc),
    title: firstNonEmpty(row.title, row.name, row.productName, row.productMainName),
    brand,
    category,
    quantity: q == null ? 0 : Math.max(0, Math.round(q)),
    listPrice: num(row.listPrice),
    salePrice: num(row.salePrice),
    approved: row.approved === true,
    images: [...new Set(images)],
  };
}

function extractRows(body: unknown): Row[] {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    for (const k of ['content', 'data', 'items']) {
      if (Array.isArray(b[k])) return b[k] as Row[];
    }
  }
  return Array.isArray(body) ? (body as Row[]) : [];
}

async function fetchAll(
  creds: { supplierId: string; apiKey: string; secretKey: string },
  approvedOnly: boolean,
): Promise<DisplayItem[]> {
  const auth = Buffer.from(`${creds.apiKey}:${creds.secretKey}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'User-Agent': `${creds.supplierId} - ViaMoodFaz2Pull`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const base = `${PRODUCT_API_BASE}/${encodeURIComponent(creds.supplierId)}/products`;
  const size = 200;
  const out: DisplayItem[] = [];
  for (let page = 0; page < 50; page++) {
    const url = `${base}?page=${page}&size=${size}${approvedOnly ? '&approved=true' : ''}`;
    const res = await fetch(url, { method: 'GET', headers });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const msg =
        (body && typeof body === 'object' && (body as Row).message) ||
        (res.status === 403 ? 'Yetki reddedildi — supplierId/apiKey/secretKey ve Trendyol yetkilerini kontrol edin.' : `HTTP ${res.status}`);
      throw new Error(`Trendyol ürün API: ${String(msg)}`);
    }
    const rows = extractRows(body);
    if (rows.length === 0) break;
    for (const r of rows) out.push(mapRow(r));
    console.log(`   · sayfa ${page}: +${rows.length} (toplam ${out.length})`);
    if (rows.length < size) break;
  }
  return out;
}

// ---------- yardımcı gösterim ----------
function money(v: number | null): string {
  return v == null ? '—' : v.toFixed(2);
}
function pad(v: string, n: number): string {
  return v.length > n ? v.slice(0, n - 1) + '…' : v.padEnd(n);
}

async function main(): Promise<void> {
  const env = loadEnv();
  const creds = {
    supplierId: env.TRENDYOL_SUPPLIER_ID || '',
    apiKey: env.TRENDYOL_API_KEY || '',
    secretKey: env.TRENDYOL_SECRET_KEY || '',
  };

  if (!creds.supplierId || !creds.apiKey || !creds.secretKey) {
    console.error(
      '❌ Eksik env: TRENDYOL_SUPPLIER_ID / TRENDYOL_API_KEY / TRENDYOL_SECRET_KEY\n' +
        "   member_id=30 mağazasının Trendyol entegrasyon bilgileri KargoLab prod DB'sinde\n" +
        "   (integration_api_keys). Bu makinede yok — .env.local'e ekleyince çalışır.",
    );
    process.exit(1);
  }

  const approvedOnly = process.argv.includes('--approved');
  const limit = Number(arg('--limit') || 20);
  const outFile = arg('--out');

  console.log(`⏳ Trendyol ürünleri çekiliyor (supplierId=${creds.supplierId}, approvedOnly=${approvedOnly})…`);
  const products = await fetchAll(creds, approvedOnly);

  const total = products.length;
  const approved = products.filter((p) => p.approved).length;
  const withImage = products.filter((p) => p.images.length > 0).length;
  const withBarcode = products.filter((p) => p.barcode !== '').length;
  const priceMissing = products.filter((p) => p.salePrice == null).length;
  const inStock = products.filter((p) => p.quantity > 0).length;

  console.log('\n=== ÖZET ===');
  console.log(`Toplam ürün        : ${total}`);
  console.log(`Onaylı (yayında)   : ${approved}`);
  console.log(`Görselli           : ${withImage}  |  görselsiz: ${total - withImage}`);
  console.log(`Barkodlu           : ${withBarcode}`);
  console.log(`Stokta (>0)        : ${inStock}`);
  console.log(`Satış fiyatı boş   : ${priceMissing}`);

  console.log(`\n=== ÖRNEK (ilk ${Math.min(limit, total)}) ===`);
  console.log(pad('BARKOD', 16) + pad('BAŞLIK', 42) + pad('SATIŞ', 9) + pad('LİSTE', 9) + pad('STOK', 6) + 'GÖRSEL');
  for (const p of products.slice(0, limit)) {
    console.log(
      pad(p.barcode || '—', 16) +
        pad(p.title || '—', 42) +
        pad(money(p.salePrice), 9) +
        pad(money(p.listPrice), 9) +
        pad(String(p.quantity), 6) +
        (p.images.length > 0 ? `✓(${p.images.length})` : '✗'),
    );
  }

  if (outFile) {
    const sample = products.slice(0, Math.max(limit, 50));
    writeFileSync(resolve(process.cwd(), outFile), JSON.stringify(sample, null, 2), 'utf8');
    console.log(`\n💾 ${sample.length} ürünlük örnek yazıldı: ${outFile}`);
  }
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
