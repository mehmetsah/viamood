'use server';

/**
 * FAZ 4 — Reklam önerileri + Influencer aksiyonları (admin).
 * Sadece ad_* tablolarına yazar; canlı sipariş/ürün akışına dokunmaz.
 *
 * Kilitli kararlar:
 *  - Öneren otomatik "evet" (create'te yazılır).
 *  - Skor = olumlu oranı %; N/N tamamlanınca kesinleşir (>=%60 → approved).
 *  - Sadece "evet" diyenler öneriye influencer ekler; aynı influencer 1 kez.
 */
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  adSuggestionInfluencers,
  adSuggestionVotes,
  adSuggestions,
  influencers,
  products,
} from '@/db/schema';
import { getSuggestionScore } from '@/lib/ads/scoring';
import { auditUser } from '@/lib/audit/logger';
import { auth } from '@/lib/auth';
import type { ActionResult } from './auth';

async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin')) {
    throw new Error('Unauthorized: admin yetkisi gerekli');
  }
  return session.user;
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const fe: Record<string, string> = {};
  for (const issue of error.issues) fe[issue.path.join('.')] = issue.message;
  return fe;
}

/** N/N tamamlandıysa skoru kesinleştir: scorePct + status(approved/rejected) + finalizedAt. */
async function maybeFinalize(suggestionId: string): Promise<void> {
  const score = await getSuggestionScore(suggestionId);
  if (!score.complete || score.scorePct == null) return;
  await db
    .update(adSuggestions)
    .set({
      scorePct: score.scorePct,
      status: score.approved ? 'approved' : 'rejected',
      finalizedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(adSuggestions.id, suggestionId));
}

const createSchema = z.object({
  productId: z.string().uuid('Ürün seç'),
  reason: z.string().max(2000).optional().or(z.literal('')),
  collabType: z.enum(['existing_video', 'collaboration']).optional().or(z.literal('')),
  videoUrl: z.string().url('Geçerli bir video URL gir').optional().or(z.literal('')),
  videoNote: z.string().max(2000).optional().or(z.literal('')),
});

/** Yeni reklam önerisi aç (+ öneren otomatik "evet"). */
export async function adminCreateSuggestionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse({
    productId: String(formData.get('productId') ?? ''),
    reason: String(formData.get('reason') ?? ''),
    collabType: String(formData.get('collabType') ?? ''),
    videoUrl: String(formData.get('videoUrl') ?? ''),
    videoNote: String(formData.get('videoNote') ?? ''),
  });
  if (!parsed.success) {
    return { success: false, error: 'Formu kontrol et', fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const d = parsed.data;

  const [p] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, d.productId))
    .limit(1);
  if (!p) return { success: false, error: 'Ürün bulunamadı' };

  let suggestionId = '';
  await db.transaction(async (tx) => {
    const [s] = await tx
      .insert(adSuggestions)
      .values({
        productId: d.productId,
        suggestedByUserId: admin.id!,
        reason: d.reason || null,
        collabType: d.collabType ? (d.collabType as 'existing_video' | 'collaboration') : null,
        videoUrl: d.videoUrl || null,
        videoNote: d.videoNote || null,
        status: 'open',
      })
      .returning({ id: adSuggestions.id });
    if (!s) throw new Error('Öneri oluşturulamadı');
    suggestionId = s.id;

    // Öneren otomatik "evet"
    await tx
      .insert(adSuggestionVotes)
      .values({ suggestionId: s.id, userId: admin.id!, vote: 'yes', comment: null })
      .onConflictDoNothing();
  });

  await maybeFinalize(suggestionId);
  await auditUser(admin.id!, 'ad.suggestion.create', 'ad_suggestion', suggestionId, {
    after: { productId: d.productId },
  });
  revalidatePath('/admin/reklam');
  return { success: true, data: { id: suggestionId } };
}

const voteSchema = z.object({
  suggestionId: z.string().uuid(),
  vote: z.enum(['yes', 'no']),
  comment: z.string().max(2000).optional().or(z.literal('')),
});

/** Öneriye oy ver (evet/hayır + açıklama). Upsert — kullanıcı fikrini değiştirebilir. */
export async function voteSuggestionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = voteSchema.safeParse({
    suggestionId: String(formData.get('suggestionId') ?? ''),
    vote: String(formData.get('vote') ?? ''),
    comment: String(formData.get('comment') ?? ''),
  });
  if (!parsed.success) return { success: false, error: 'Oy geçersiz' };
  const d = parsed.data;

  await db
    .insert(adSuggestionVotes)
    .values({ suggestionId: d.suggestionId, userId: admin.id!, vote: d.vote, comment: d.comment || null })
    .onConflictDoUpdate({
      target: [adSuggestionVotes.suggestionId, adSuggestionVotes.userId],
      set: { vote: d.vote, comment: d.comment || null, updatedAt: new Date() },
    });

  await maybeFinalize(d.suggestionId);
  revalidatePath(`/admin/reklam/${d.suggestionId}`);
  revalidatePath('/admin/reklam');
  return { success: true };
}

const influencerSchema = z.object({
  handle: z.string().min(1, 'Kullanıcı adı gir').max(120),
  instagramUrl: z.string().url('Geçerli bir Instagram URL gir'),
  displayName: z.string().max(160).optional().or(z.literal('')),
  followerCount: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

/** Yeni influencer profili oluştur (istatistik linke tıkla; followerCount elle). */
export async function adminCreateInfluencerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const followerRaw = formData.get('followerCount');
  const parsed = influencerSchema.safeParse({
    handle: String(formData.get('handle') ?? '').trim().replace(/^@/, ''),
    instagramUrl: String(formData.get('instagramUrl') ?? '').trim(),
    displayName: String(formData.get('displayName') ?? '').trim(),
    followerCount: followerRaw ? Number(followerRaw) : null,
    notes: String(formData.get('notes') ?? ''),
  });
  if (!parsed.success) {
    return { success: false, error: 'Formu kontrol et', fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const d = parsed.data;

  try {
    const [row] = await db
      .insert(influencers)
      .values({
        handle: d.handle,
        instagramUrl: d.instagramUrl,
        displayName: d.displayName || null,
        followerCount: d.followerCount ?? null,
        notes: d.notes || null,
        addedByUserId: admin.id!,
      })
      .returning({ id: influencers.id });
    await auditUser(admin.id!, 'ad.influencer.create', 'influencer', row?.id ?? '', {
      after: { handle: d.handle },
    });
  } catch {
    return {
      success: false,
      error: 'Bu kullanıcı adı zaten kayıtlı',
      fieldErrors: { handle: 'Zaten kayıtlı' },
    };
  }
  revalidatePath('/admin/influencers');
  return { success: true };
}

const linkSchema = z.object({
  suggestionId: z.string().uuid(),
  influencerId: z.string().uuid('Influencer seç'),
});

/** Öneriye influencer ekle — SADECE "evet" diyenler; aynı influencer 1 kez. */
export async function addInfluencerToSuggestionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = linkSchema.safeParse({
    suggestionId: String(formData.get('suggestionId') ?? ''),
    influencerId: String(formData.get('influencerId') ?? ''),
  });
  if (!parsed.success) return { success: false, error: 'Influencer seç' };
  const d = parsed.data;

  const [myVote] = await db
    .select({ vote: adSuggestionVotes.vote })
    .from(adSuggestionVotes)
    .where(
      and(
        eq(adSuggestionVotes.suggestionId, d.suggestionId),
        eq(adSuggestionVotes.userId, admin.id!),
      ),
    )
    .limit(1);
  if (!myVote || myVote.vote !== 'yes') {
    return { success: false, error: 'Influencer eklemek için bu öneriye "evet" oyu vermelisin.' };
  }

  await db
    .insert(adSuggestionInfluencers)
    .values({ suggestionId: d.suggestionId, influencerId: d.influencerId, addedByUserId: admin.id! })
    .onConflictDoNothing();

  revalidatePath(`/admin/reklam/${d.suggestionId}`);
  return { success: true };
}

const advanceSchema = z.object({
  suggestionId: z.string().uuid(),
  status: z.enum(['meta_ready', 'published', 'done']),
});

/**
 * Durum ilerlet — Meta otomasyonu gelene kadar MANUEL akış:
 * approved → meta_ready → published → done. (Void action; inline form ile çağrılır.)
 */
export async function advanceSuggestionStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = advanceSchema.safeParse({
    suggestionId: String(formData.get('suggestionId') ?? ''),
    status: String(formData.get('status') ?? ''),
  });
  if (!parsed.success) return;
  const { suggestionId, status } = parsed.data;

  await db
    .update(adSuggestions)
    .set({ status, updatedAt: new Date() })
    .where(eq(adSuggestions.id, suggestionId));

  await auditUser(admin.id!, 'ad.suggestion.status', 'ad_suggestion', suggestionId, {
    after: { status },
  });
  revalidatePath(`/admin/reklam/${suggestionId}`);
  revalidatePath('/admin/reklam');
}
