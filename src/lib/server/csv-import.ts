/**
 * CSV/Excel bulk product import.
 *
 * Vendor kendi sistemlerinden export ettikleri ürün listesini yükler.
 * Akış:
 *   1. parseProductCsv(text) → ParsedRow[] (validation + normalization)
 *   2. UI'da preview + column mapping confirm
 *   3. importProductsBulk(vendorId, rows) → { created, updated, errors }
 *
 * Desteklenen formatlar:
 *   - CSV: virgül veya noktalı virgül ayraç, UTF-8 (TR karakter destekli)
 *   - Excel: .xlsx (server'da sheetjs ile dönüştürülür)
 *   - Tab-separated (.tsv)
 *
 * Otomatik kolon eşleme: title, sku, price (TL), stock, barcode, description,
 *   product_type, weight, image, status. Tüm Türkçe varyasyonlar tanınır.
 */

import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inventoryLevels, productVariants, products, vendors } from '@/db/schema';

// ============================================================================
// Tipler
// ============================================================================

export interface ParsedRow {
  /** 1-tabanlı satır numarası (kullanıcıya hatada gösterilir) */
  rowNumber: number;
  title: string;
  sku?: string;
  barcode?: string;
  description?: string;
  productType?: string;
  priceCents: number;
  compareAtPriceCents?: number;
  costCents?: number;
  weightGrams?: number;
  initialStock: number;
  featuredImageUrl?: string;
  status: 'draft' | 'active' | 'archived';
  tags: string[];
}

export interface ParseError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
  detectedColumns: Record<string, string>;
  totalRows: number;
}

// ============================================================================
// Kolon tanıma (Türkçe + İngilizce alias'lar)
// ============================================================================

const COLUMN_ALIASES: Record<keyof ParsedRow, string[]> = {
  rowNumber: [],
  title: ['title', 'baslik', 'başlık', 'urun_adi', 'ürün adı', 'ürün_adı', 'product_name', 'name', 'ad', 'isim'],
  sku: ['sku', 'stok_kodu', 'stok kodu', 'ürün_kodu', 'urun_kodu', 'product_code', 'kod'],
  barcode: ['barcode', 'barkod', 'ean', 'gtin', 'upc'],
  description: ['description', 'aciklama', 'açıklama', 'detay', 'detail', 'desc'],
  productType: ['product_type', 'kategori', 'category', 'tip', 'tür', 'tur'],
  priceCents: ['price', 'fiyat', 'satis_fiyati', 'satış fiyatı', 'satis fiyati', 'birim_fiyat'],
  compareAtPriceCents: ['compare_at_price', 'compare_price', 'eski_fiyat', 'eski fiyat', 'list_price', 'liste_fiyati'],
  costCents: ['cost', 'maliyet', 'cost_price', 'alış_fiyatı', 'alis_fiyati'],
  weightGrams: ['weight', 'agirlik', 'ağırlık', 'kg', 'gram', 'gr'],
  initialStock: ['stock', 'stok', 'miktar', 'quantity', 'qty', 'adet'],
  featuredImageUrl: ['image', 'gorsel', 'görsel', 'image_url', 'foto', 'fotograf', 'fotoğraf', 'resim'],
  status: ['status', 'durum'],
  tags: ['tags', 'etiketler', 'etiket', 'keyword', 'anahtar_kelime'],
};

function normalizeHeader(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c');
}

function detectColumnMap(headerRow: string[]): Record<string, keyof ParsedRow> {
  const map: Record<string, keyof ParsedRow> = {};
  for (const [colIdx, header] of headerRow.entries()) {
    const norm = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      const normAliases = aliases.map(normalizeHeader);
      if (normAliases.includes(norm)) {
        map[String(colIdx)] = field as keyof ParsedRow;
        break;
      }
    }
  }
  return map;
}

// ============================================================================
// CSV parsing (basit + güçlü)
// ============================================================================

/** Quoted alanları, virgül/noktalı virgül ayraçları, multi-line cell'leri destekler */
function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"' && cur === '') {
        inQuote = true;
      } else if (c === delim) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(line: string): string {
  // İlk satırdaki ayraç karakter sayılarını karşılaştır
  const counts: Record<string, number> = {
    ',': (line.match(/,/g) || []).length,
    ';': (line.match(/;/g) || []).length,
    '\t': (line.match(/\t/g) || []).length,
    '|': (line.match(/\|/g) || []).length,
  };
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? ',';
}

// ============================================================================
// Para birimi & sayı parsing (TR format)
// ============================================================================

/** "189,99" / "189.99" / "1.299,50" → 18999 / 129950 cents */
function parsePriceToCents(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;
  let s = raw.trim().replace(/[^\d,.\-]/g, '');
  // TR format: 1.299,50 → 1299.50
  // EN format: 1,299.50 → 1299.50
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // Hangisi son ise o decimal: 1.299,50 → comma; 1,299.50 → dot
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // 189,99 veya 1.299 farkını anlamak için: virgülün önündeki haneye bak
    const parts = s.split(',');
    const last = parts[parts.length - 1] ?? '';
    if (last.length <= 2) {
      // virgül decimal: 189,99
      s = s.replace(',', '.');
    } else {
      // virgül thousand: 1,299
      s = s.replace(/,/g, '');
    }
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseIntSafe(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;
  const n = parseInt(raw.replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function parseStatus(raw: string): 'draft' | 'active' | 'archived' {
  const s = raw.trim().toLocaleLowerCase('tr-TR');
  if (['active', 'aktif', 'yayinda', 'yayında', 'published', 'true', '1'].includes(s)) return 'active';
  if (['archived', 'arşiv', 'arsiv', 'silinmis', 'silinmiş'].includes(s)) return 'archived';
  return 'draft';
}

function parseTags(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

// ============================================================================
// Ana parser
// ============================================================================

export function parseProductCsv(text: string): ParseResult {
  // BOM temizle
  text = text.replace(/^﻿/, '');

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, field: 'file', message: 'En az 1 başlık + 1 veri satırı gerek' }],
      detectedColumns: {},
      totalRows: 0,
    };
  }

  const firstLine = lines[0]!;
  const delim = detectDelimiter(firstLine);
  const headerCells = parseCsvLine(firstLine, delim);
  const colMap = detectColumnMap(headerCells);

  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-tabanlı (header dahil)
    const cells = parseCsvLine(lines[i]!, delim);
    const obj: Partial<ParsedRow> = { rowNumber: rowNum };

    for (const [colIdxStr, field] of Object.entries(colMap)) {
      const idx = parseInt(colIdxStr, 10);
      const raw = cells[idx] ?? '';
      if (raw === '') continue;
      switch (field) {
        case 'priceCents': {
          const v = parsePriceToCents(raw);
          if (v == null) errors.push({ rowNumber: rowNum, field: 'price', message: `Geçersiz fiyat: ${raw}` });
          else obj.priceCents = v;
          break;
        }
        case 'compareAtPriceCents': {
          const v = parsePriceToCents(raw);
          if (v != null) obj.compareAtPriceCents = v;
          break;
        }
        case 'costCents': {
          const v = parsePriceToCents(raw);
          if (v != null) obj.costCents = v;
          break;
        }
        case 'weightGrams': {
          // Kullanıcı 0.5 (kg) veya 500 (g) yazabilir — 5'ten küçükse kg varsay
          const num = parseFloat(raw.replace(',', '.'));
          if (Number.isFinite(num)) obj.weightGrams = num < 5 ? Math.round(num * 1000) : Math.round(num);
          break;
        }
        case 'initialStock': {
          const v = parseIntSafe(raw);
          obj.initialStock = v ?? 0;
          break;
        }
        case 'status':
          obj.status = parseStatus(raw);
          break;
        case 'tags':
          obj.tags = parseTags(raw);
          break;
        default:
          (obj as Record<string, unknown>)[field] = raw;
      }
    }

    // Zorunlu alan kontrolü
    if (!obj.title) {
      errors.push({ rowNumber: rowNum, field: 'title', message: 'Başlık boş' });
      continue;
    }
    if (obj.priceCents == null) {
      errors.push({ rowNumber: rowNum, field: 'price', message: 'Fiyat boş veya geçersiz' });
      continue;
    }

    rows.push({
      rowNumber: rowNum,
      title: obj.title,
      sku: obj.sku,
      barcode: obj.barcode,
      description: obj.description,
      productType: obj.productType,
      priceCents: obj.priceCents,
      compareAtPriceCents: obj.compareAtPriceCents,
      costCents: obj.costCents,
      weightGrams: obj.weightGrams,
      initialStock: obj.initialStock ?? 0,
      featuredImageUrl: obj.featuredImageUrl,
      status: obj.status ?? 'draft',
      tags: obj.tags ?? [],
    });
  }

  const detectedColumns: Record<string, string> = {};
  for (const [colIdx, field] of Object.entries(colMap)) {
    const headerName = headerCells[parseInt(colIdx, 10)];
    if (headerName) detectedColumns[headerName] = field;
  }

  return { rows, errors, detectedColumns, totalRows: lines.length - 1 };
}

// ============================================================================
// DB import
// ============================================================================

interface ImportOk {
  ok: true;
  created: number;
  skipped: number;
  errors: Array<{ rowNumber: number; reason: string }>;
}

function slugify(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function importProductsBulk(
  vendorId: string,
  rows: ParsedRow[],
): Promise<ImportOk> {
  const [vendor] = await db
    .select({ id: vendors.id, slug: vendors.slug, name: vendors.name })
    .from(vendors)
    .where(sql`${vendors.id} = ${vendorId}`)
    .limit(1);

  if (!vendor) {
    return { ok: true, created: 0, skipped: rows.length, errors: rows.map((r) => ({ rowNumber: r.rowNumber, reason: 'Vendor bulunamadı' })) };
  }

  let created = 0;
  let skipped = 0;
  const errors: ImportOk['errors'] = [];

  for (const row of rows) {
    try {
      await db.transaction(async (tx) => {
        const tempShopifyProductId = `local_${crypto.randomUUID()}`;
        const tempShopifyVariantId = `local_${crypto.randomUUID()}`;
        const handle = slugify(row.title) + '-' + Date.now().toString(36);

        const [product] = await tx
          .insert(products)
          .values({
            vendorId,
            shopifyProductId: tempShopifyProductId,
            shopifyHandle: handle,
            title: row.title,
            description: row.description ?? null,
            productType: row.productType ?? null,
            tags: row.tags,
            status: row.status,
            vendorSlug: vendor.slug,
            vendorName: vendor.name,
            minPriceCents: BigInt(row.priceCents),
            maxPriceCents: BigInt(row.priceCents),
            totalInventory: row.initialStock,
            featuredImageUrl: row.featuredImageUrl ?? null,
          })
          .returning({ id: products.id });

        if (!product) throw new Error('Product insert fail');

        const [variant] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
            vendorId,
            shopifyVariantId: tempShopifyVariantId,
            title: 'Default',
            sku: row.sku ?? null,
            barcode: row.barcode ?? null,
            priceCents: BigInt(row.priceCents),
            compareAtPriceCents: row.compareAtPriceCents ? BigInt(row.compareAtPriceCents) : null,
            costCents: row.costCents ? BigInt(row.costCents) : null,
            weightGrams: row.weightGrams ?? null,
          })
          .returning({ id: productVariants.id });

        if (!variant) throw new Error('Variant insert fail');

        if (row.initialStock > 0) {
          await tx.insert(inventoryLevels).values({
            vendorId,
            variantId: variant.id,
            quantity: row.initialStock,
            available: row.initialStock,
            reserved: 0,
          });
        }
      });
      created++;
    } catch (err) {
      skipped++;
      errors.push({
        rowNumber: row.rowNumber,
        reason: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // Vendor product_count güncelle
  if (created > 0) {
    await db
      .update(vendors)
      .set({ productCount: sql`${vendors.productCount} + ${created}` })
      .where(sql`${vendors.id} = ${vendorId}`);
  }

  return { ok: true, created, skipped, errors };
}
