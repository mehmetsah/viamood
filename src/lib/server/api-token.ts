/**
 * Vendor API token management.
 *
 * - generateToken(vendorId, name, scopes) → plaintext (sadece bir kere döner)
 * - verifyToken(plaintext) → vendorContext | null
 *
 * Bearer auth header: `Authorization: Bearer vnd_<prefix>_<secret>`
 * Storage: SHA-256(plaintext) DB'de tutulur.
 */
import crypto from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { vendorApiTokens, vendors } from '@/db/schema';

export const ALL_SCOPES = [
  'products:read',
  'products:write',
  'inventory:read',
  'inventory:write',
  'orders:read',
] as const;
export type ApiScope = (typeof ALL_SCOPES)[number];

function hashToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

function generatePlaintextToken(vendorId: string): { plaintext: string; prefix: string } {
  const vendorPrefix = vendorId.replace(/-/g, '').slice(0, 8);
  const secret = crypto.randomBytes(24).toString('base64url');
  const plaintext = `vnd_${vendorPrefix}_${secret}`;
  // Prefix UI'da gösterilir ki kullanıcı hangisi olduğunu anlasın
  const prefix = plaintext.slice(0, 16);
  return { plaintext, prefix };
}

export interface CreateTokenResult {
  ok: true;
  plaintext: string;
  prefix: string;
  id: string;
}

export async function createApiToken(input: {
  vendorId: string;
  createdByUserId: string;
  name: string;
  scopes: ApiScope[];
  expiresAt?: Date;
}): Promise<CreateTokenResult> {
  const { plaintext, prefix } = generatePlaintextToken(input.vendorId);
  const tokenHash = hashToken(plaintext);

  const [created] = await db
    .insert(vendorApiTokens)
    .values({
      vendorId: input.vendorId,
      createdByUserId: input.createdByUserId,
      name: input.name.slice(0, 80),
      prefix,
      tokenHash,
      scopes: input.scopes,
      expiresAt: input.expiresAt ?? null,
    })
    .returning({ id: vendorApiTokens.id });

  if (!created) throw new Error('token insert fail');
  return { ok: true, plaintext, prefix, id: created.id };
}

export interface ApiAuthContext {
  vendorId: string;
  vendorSlug: string;
  vendorName: string;
  vendorStatus: string;
  tokenId: string;
  scopes: ApiScope[];
}

/** Bearer token'ı doğrula. Geçersizse null döner. */
export async function verifyApiToken(authHeader: string | null): Promise<ApiAuthContext | null> {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m || !m[1]) return null;
  const plaintext = m[1].trim();
  if (!plaintext.startsWith('vnd_')) return null;

  const tokenHash = hashToken(plaintext);

  const [row] = await db
    .select({
      tokenId: vendorApiTokens.id,
      vendorId: vendorApiTokens.vendorId,
      scopes: vendorApiTokens.scopes,
      expiresAt: vendorApiTokens.expiresAt,
      revokedAt: vendorApiTokens.revokedAt,
      vendorSlug: vendors.slug,
      vendorName: vendors.name,
      vendorStatus: vendors.status,
    })
    .from(vendorApiTokens)
    .innerJoin(vendors, eq(vendors.id, vendorApiTokens.vendorId))
    .where(and(eq(vendorApiTokens.tokenHash, tokenHash), isNull(vendorApiTokens.revokedAt)))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  return {
    vendorId: row.vendorId,
    vendorSlug: row.vendorSlug,
    vendorName: row.vendorName,
    vendorStatus: row.vendorStatus,
    tokenId: row.tokenId,
    scopes: (row.scopes ?? []) as ApiScope[],
  };
}

/** Token kullanım tracking (best-effort, sync ile aynı request'i bloklamaz) */
export async function touchTokenUsage(tokenId: string, ip?: string): Promise<void> {
  await db
    .update(vendorApiTokens)
    .set({
      lastUsedAt: new Date(),
      lastUsedIp: ip ?? null,
    })
    .where(eq(vendorApiTokens.id, tokenId));
}

export async function revokeApiToken(
  tokenId: string,
  reason?: string,
): Promise<void> {
  await db
    .update(vendorApiTokens)
    .set({
      revokedAt: new Date(),
      revokedReason: reason ?? null,
    })
    .where(eq(vendorApiTokens.id, tokenId));
}

export function hasScope(ctx: ApiAuthContext, scope: ApiScope): boolean {
  return ctx.scopes.includes(scope);
}
