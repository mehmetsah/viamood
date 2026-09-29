/**
 * Trendyol bağlantı katmanı — vendor_integrations üzerinden şifreli kredensiyel
 * saklama + bağlantı testi + kredensiyel çözme (çekim job'ları için).
 *
 * Sunucu tarafı yardımcıları (server action / worker'dan çağrılır). Kredensiyel
 * düz metin DÖNMEZ dışarıya; yalnız fetch için içeride çözülür.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { vendorIntegrations } from '@/db/schema';
import { decryptSecret, encryptSecret } from '@/lib/crypto/secretbox';
import { fetchTrendyolProducts, TrendyolError } from '@/lib/trendyol/client';
import type { TrendyolCredentials } from '@/lib/trendyol/types';

export interface SaveTrendyolInput {
  vendorId: string;
  supplierId: string;
  apiKey: string;
  secretKey: string;
  userId?: string;
}

/** Bağlantıyı kaydeder/günceller (upsert). Kredensiyel şifreli yazılır; status resetlenir. */
export async function saveTrendyolConnection(input: SaveTrendyolInput): Promise<void> {
  const credentialEnc = encryptSecret(
    JSON.stringify({ apiKey: input.apiKey.trim(), secretKey: input.secretKey.trim() }),
  );
  const supplierId = input.supplierId.trim();
  const now = new Date();

  await db
    .insert(vendorIntegrations)
    .values({
      vendorId: input.vendorId,
      provider: 'trendyol',
      externalSupplierId: supplierId,
      credentialEnc,
      status: 'disconnected',
      createdBy: input.userId ?? null,
    })
    .onConflictDoUpdate({
      target: [vendorIntegrations.vendorId, vendorIntegrations.provider],
      set: {
        externalSupplierId: supplierId,
        credentialEnc,
        status: 'disconnected',
        lastError: null,
        updatedAt: now,
      },
    });
}

/** Bir vendor'ın Trendyol bağlantı satırını döner (kredensiyel ŞİFRELİ kalır). */
export async function getTrendyolIntegration(vendorId: string) {
  const [row] = await db
    .select()
    .from(vendorIntegrations)
    .where(
      and(eq(vendorIntegrations.vendorId, vendorId), eq(vendorIntegrations.provider, 'trendyol')),
    )
    .limit(1);
  return row ?? null;
}

/** Çözülmüş kredensiyel — yalnız sunucu tarafı çekim için. Yoksa null. */
export async function getTrendyolCredentials(vendorId: string): Promise<TrendyolCredentials | null> {
  const row = await getTrendyolIntegration(vendorId);
  if (!row) return null;
  const parsed = JSON.parse(decryptSecret(row.credentialEnc)) as {
    apiKey?: string;
    secretKey?: string;
  };
  if (!parsed.apiKey || !parsed.secretKey) return null;
  return { supplierId: row.externalSupplierId, apiKey: parsed.apiKey, secretKey: parsed.secretKey };
}

export interface TrendyolTestResult {
  ok: boolean;
  productCount: number;
  sample: Array<{
    barcode: string;
    title: string;
    salePrice: number | null;
    listPrice: number | null;
    quantity: number;
    hasImage: boolean;
  }>;
  error?: string;
}

/**
 * Bağlantıyı test eder: ilk sayfayı (≤50 ürün) çeker, status/lastTestedAt/productCount
 * günceller ve küçük bir örnek döner. Tüm kataloğu ÇEKMEZ (hızlı doğrulama).
 */
export async function testTrendyolConnection(vendorId: string): Promise<TrendyolTestResult> {
  const creds = await getTrendyolCredentials(vendorId);
  if (!creds) {
    return { ok: false, productCount: 0, sample: [], error: 'Kayıtlı Trendyol bağlantısı bulunamadı.' };
  }

  const setWhere = and(
    eq(vendorIntegrations.vendorId, vendorId),
    eq(vendorIntegrations.provider, 'trendyol'),
  );

  try {
    const products = await fetchTrendyolProducts(creds, {
      pageSize: 50,
      maxPages: 1,
      userAgentLabel: 'ViaMoodConnTest',
    });
    const sample = products.slice(0, 10).map((p) => ({
      barcode: p.barcode,
      title: p.title,
      salePrice: p.salePrice,
      listPrice: p.listPrice,
      quantity: p.quantity,
      hasImage: p.images.length > 0,
    }));

    await db
      .update(vendorIntegrations)
      .set({
        status: 'connected',
        lastTestedAt: new Date(),
        lastError: null,
        productCount: products.length,
        updatedAt: new Date(),
      })
      .where(setWhere);

    return { ok: true, productCount: products.length, sample };
  } catch (e) {
    const msg =
      e instanceof TrendyolError
        ? `HTTP ${e.status}: ${e.message}`
        : e instanceof Error
          ? e.message
          : 'Bilinmeyen hata';

    await db
      .update(vendorIntegrations)
      .set({ status: 'error', lastTestedAt: new Date(), lastError: msg, updatedAt: new Date() })
      .where(setWhere);

    return { ok: false, productCount: 0, sample: [], error: msg };
  }
}
