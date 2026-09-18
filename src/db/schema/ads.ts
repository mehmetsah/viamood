import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { users } from './auth';
import { products } from './products';

/**
 * FAZ 4 — Reklam önerileri + Influencer platformu.
 * Additive; canlı sipariş/fulfillment akışına dokunmaz.
 *
 * Kilitli kararlar (2026-07-14):
 *  - Öneri kartı: satışçı açar, herkes evet/hayır + açıklama ile oy verir.
 *  - Payda N = o anki admin sayısı, DİNAMİK (snapshot değil). İlerleme N/x.
 *  - Oylama CANLI/ŞEFFAF (kör değil); kim ne dedi anında görünür.
 *  - Skor = olumlu oy ORANI (%). N/N tamamlanınca kesinleşir (scorePct).
 *  - Skor >= %60 → 'approved' (reklama uygun) → Meta veri hazırlığı; < %60 → 'rejected'.
 *  - Öneren otomatik 'yes' sayılır (oy kaydı olarak yazılır).
 *  - Influencer: sadece istatistik linke tıkla (API yok); followerCount elle.
 *  - Öneriye "evet" diyenler influencer ekler; aynı influencer 1 kez; kim ekledi kayıtlı.
 */

export const adSuggestionStatus = pgEnum('ad_suggestion_status', [
  'open',       // Oylama sürüyor (N/x)
  'scored',     // Tüm oylar geldi (N/N), skor kesinleşti
  'approved',   // Skor >= %60 → reklama uygun
  'rejected',   // Skor < %60
  'meta_ready', // Meta Business verisi hazırlandı
  'published',  // Reklam yayınlandı
  'done',       // Tamamlandı
]);

export const adVote = pgEnum('ad_vote', ['yes', 'no']);

/** Öneri kaynağı: internette hazır video mu, işbirliği önerisi mi. */
export const adCollabType = pgEnum('ad_collab_type', ['existing_video', 'collaboration']);

export const adSuggestions = pgTable(
  'ad_suggestions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    suggestedByUserId: uuid('suggested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    status: adSuggestionStatus('status').notNull().default('open'),
    reason: text('reason'), // satışçının "neden iddialı" notu

    // Öneriye eklenen video / işbirliği
    collabType: adCollabType('collab_type'),
    videoUrl: text('video_url'),   // influencer videosu (link)
    videoNote: text('video_note'), // veya text olarak

    // Skor — N/N tamamlanınca hesaplanır (olumlu oranı %). Canlı sayaç oylardan türetilir.
    scorePct: integer('score_pct'),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps(),
  },
  (t) => [
    index('ad_suggestions_product_idx').on(t.productId),
    index('ad_suggestions_status_idx').on(t.status),
  ],
);

/** Bir öneriye bir kullanıcının oyu (evet/hayır + açıklama). Kullanıcı başına tek oy. */
export const adSuggestionVotes = pgTable(
  'ad_suggestion_votes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    suggestionId: uuid('suggestion_id')
      .notNull()
      .references(() => adSuggestions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vote: adVote('vote').notNull(),
    comment: text('comment'), // açıklama/gerekçe (daha mantıklı; opsiyonel)
    ...timestamps(),
  },
  (t) => [
    unique('ad_vote_suggestion_user_uq').on(t.suggestionId, t.userId),
    index('ad_votes_suggestion_idx').on(t.suggestionId),
  ],
);

/** Influencer profili — istatistik linke tıkla (API yok); followerCount elle girilir. */
export const influencers = pgTable(
  'influencers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    handle: text('handle').notNull(),                 // @kullanici
    instagramUrl: text('instagram_url').notNull(),    // profil linki (tıklayınca gider)
    displayName: text('display_name'),
    followerCount: integer('follower_count'),         // kaba rakam (elle)
    notes: text('notes'),
    addedByUserId: uuid('added_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps(),
  },
  (t) => [unique('influencers_handle_uq').on(t.handle)],
);

/**
 * Öneriye eklenen influencer bağlantısı.
 * "Evet" diyenler ekler; aynı influencer öneriye 1 kez; kim ekledi kayıtlı.
 */
export const adSuggestionInfluencers = pgTable(
  'ad_suggestion_influencers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    suggestionId: uuid('suggestion_id')
      .notNull()
      .references(() => adSuggestions.id, { onDelete: 'cascade' }),
    influencerId: uuid('influencer_id')
      .notNull()
      .references(() => influencers.id, { onDelete: 'cascade' }),
    addedByUserId: uuid('added_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps(),
  },
  (t) => [
    unique('ad_sug_inf_uq').on(t.suggestionId, t.influencerId), // aynı influencer 1 kez
    index('ad_sug_inf_suggestion_idx').on(t.suggestionId),
  ],
);
