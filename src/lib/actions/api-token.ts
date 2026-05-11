'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  ALL_SCOPES,
  createApiToken,
  revokeApiToken,
  type ApiScope,
} from '@/lib/server/api-token';
import { auditUser } from '@/lib/audit/logger';
import { requireActiveVendor } from '@/lib/server/vendor-context';

const createSchema = z.object({
  name: z.string().min(2).max(80),
  scopes: z.array(z.enum(ALL_SCOPES)).min(1),
});

export interface CreateTokenResponse {
  success: boolean;
  plaintext?: string;
  prefix?: string;
  id?: string;
  error?: string;
}

export async function createApiTokenAction(
  _prev: CreateTokenResponse | null,
  formData: FormData,
): Promise<CreateTokenResponse> {
  const ctx = await requireActiveVendor();

  const name = String(formData.get('name') ?? '').trim();
  const scopesRaw = formData.getAll('scopes').map((s) => String(s));

  const parsed = createSchema.safeParse({ name, scopes: scopesRaw });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'invalid' };
  }

  const result = await createApiToken({
    vendorId: ctx.vendorId,
    createdByUserId: ctx.userId,
    name: parsed.data.name,
    scopes: parsed.data.scopes as ApiScope[],
  });

  await auditUser(ctx.userId, 'api_token.create', 'vendor', ctx.vendorId, {
    after: { tokenId: result.id, name: parsed.data.name, scopes: parsed.data.scopes },
  });

  revalidatePath('/profile');
  return { success: true, plaintext: result.plaintext, prefix: result.prefix, id: result.id };
}

export async function revokeApiTokenAction(formData: FormData): Promise<void> {
  const ctx = await requireActiveVendor();
  const tokenId = z.string().uuid().parse(formData.get('tokenId'));
  const reason = String(formData.get('reason') ?? 'revoked by vendor');

  await revokeApiToken(tokenId, reason);
  await auditUser(ctx.userId, 'api_token.revoke', 'vendor', ctx.vendorId, {
    after: { tokenId, reason },
  });
  revalidatePath('/profile');
}
