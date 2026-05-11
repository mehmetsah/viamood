'use server';

import { revalidatePath } from 'next/cache';
import { auditUser } from '@/lib/audit/logger';
import {
  importProductsBulk,
  parseProductCsv,
  type ParsedRow,
} from '@/lib/server/csv-import';
import { canEdit, requireActiveVendor } from '@/lib/server/vendor-context';

export interface ParseActionResult {
  success: boolean;
  preview?: {
    rows: ParsedRow[];
    detectedColumns: Record<string, string>;
    errors: Array<{ rowNumber: number; field: string; message: string }>;
    totalRows: number;
  };
  error?: string;
}

export async function parseProductCsvAction(
  _prev: ParseActionResult | null,
  formData: FormData,
): Promise<ParseActionResult> {
  await requireActiveVendor();

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { success: false, error: 'Dosya seçilmedi' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'Dosya 5 MB\'dan büyük' };
  }
  const text = await file.text();
  const parsed = parseProductCsv(text);
  return {
    success: true,
    preview: {
      rows: parsed.rows,
      detectedColumns: parsed.detectedColumns,
      errors: parsed.errors,
      totalRows: parsed.totalRows,
    },
  };
}

export interface ImportActionResult {
  success: boolean;
  created?: number;
  skipped?: number;
  errors?: Array<{ rowNumber: number; reason: string }>;
  error?: string;
}

export async function importProductsAction(
  _prev: ImportActionResult | null,
  formData: FormData,
): Promise<ImportActionResult> {
  const ctx = await requireActiveVendor();
  if (!canEdit(ctx.role)) return { success: false, error: 'Yetkin yok' };

  const rowsJson = String(formData.get('rows') ?? '');
  if (!rowsJson) return { success: false, error: 'Veri yok' };

  let rows: ParsedRow[];
  try {
    rows = JSON.parse(rowsJson) as ParsedRow[];
  } catch {
    return { success: false, error: 'JSON parse hatası' };
  }
  if (rows.length === 0) return { success: false, error: 'En az 1 ürün gerek' };
  if (rows.length > 2000) {
    return { success: false, error: 'Tek seferde en fazla 2000 satır' };
  }

  const result = await importProductsBulk(ctx.vendorId, rows);

  await auditUser(ctx.userId, 'product.bulk_import', 'vendor', ctx.vendorId, {
    after: {
      attempted: rows.length,
      created: result.created,
      skipped: result.skipped,
    },
  });

  revalidatePath('/products');
  return {
    success: true,
    created: result.created,
    skipped: result.skipped,
    errors: result.errors,
  };
}
