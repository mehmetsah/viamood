import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import {
  adSuggestionInfluencers,
  adSuggestionVotes,
  adSuggestions,
  influencers,
  products,
  users,
} from '@/db/schema';
import {
  addInfluencerToSuggestionAction,
  advanceSuggestionStatusAction,
  voteSuggestionAction,
} from '@/lib/actions/ads';
import { getSuggestionScore } from '@/lib/ads/scoring';
import { auth } from '@/lib/auth';
import { AddInfluencerForm } from './AddInfluencerForm';
import { VoteForm } from './VoteForm';

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Oylama sürüyor', cls: 'bg-blue-100 text-blue-800' },
  scored: { label: 'Skorlandı', cls: 'bg-neutral-200 text-neutral-700' },
  approved: { label: 'Reklama uygun', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Uygun değil', cls: 'bg-red-100 text-red-700' },
  meta_ready: { label: 'Meta hazır', cls: 'bg-purple-100 text-purple-800' },
  published: { label: 'Yayınlandı', cls: 'bg-green-100 text-green-800' },
  done: { label: 'Tamamlandı', cls: 'bg-neutral-200 text-neutral-700' },
};

export default async function AdminReklamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? '';

  const [row] = await db
    .select({
      id: adSuggestions.id,
      status: adSuggestions.status,
      reason: adSuggestions.reason,
      collabType: adSuggestions.collabType,
      videoUrl: adSuggestions.videoUrl,
      videoNote: adSuggestions.videoNote,
      scorePct: adSuggestions.scorePct,
      productId: products.id,
      productTitle: products.title,
      productImage: products.featuredImageUrl,
      proposer: users.name,
    })
    .from(adSuggestions)
    .innerJoin(products, eq(adSuggestions.productId, products.id))
    .leftJoin(users, eq(adSuggestions.suggestedByUserId, users.id))
    .where(eq(adSuggestions.id, id))
    .limit(1);
  if (!row) notFound();

  const score = await getSuggestionScore(id);

  const votes = await db
    .select({
      userId: adSuggestionVotes.userId,
      voterName: users.name,
      vote: adSuggestionVotes.vote,
      comment: adSuggestionVotes.comment,
      at: adSuggestionVotes.updatedAt,
    })
    .from(adSuggestionVotes)
    .leftJoin(users, eq(adSuggestionVotes.userId, users.id))
    .where(eq(adSuggestionVotes.suggestionId, id))
    .orderBy(desc(adSuggestionVotes.updatedAt));

  const myVote = votes.find((v) => v.userId === userId)?.vote ?? null;

  const adder = alias(users, 'adder');
  const linked = await db
    .select({
      influencerId: influencers.id,
      handle: influencers.handle,
      displayName: influencers.displayName,
      instagramUrl: influencers.instagramUrl,
      followerCount: influencers.followerCount,
      addedBy: adder.name,
    })
    .from(adSuggestionInfluencers)
    .innerJoin(influencers, eq(adSuggestionInfluencers.influencerId, influencers.id))
    .leftJoin(adder, eq(adSuggestionInfluencers.addedByUserId, adder.id))
    .where(eq(adSuggestionInfluencers.suggestionId, id));

  const linkedIds = new Set(linked.map((l) => l.influencerId));
  const allInfluencers = await db
    .select({ id: influencers.id, handle: influencers.handle, displayName: influencers.displayName })
    .from(influencers)
    .orderBy(influencers.handle);
  const addableInfluencers = allInfluencers.filter((i) => !linkedIds.has(i.id));

  const st = STATUS[row.status] ?? { label: row.status, cls: 'bg-neutral-200' };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/admin/reklam" className="text-sm text-neutral-600 hover:underline">
        ← Reklam Önerileri
      </Link>

      <div className="flex items-start gap-4 mt-3 mb-6">
        {row.productImage ? (
          <img src={row.productImage} alt="" className="w-20 h-20 rounded-xl object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-neutral-100" />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{row.productTitle}</h1>
          <p className="text-sm text-neutral-500">Öneren: {row.proposer ?? '—'}</p>
          {row.reason && <p className="text-sm text-neutral-700 mt-2">{row.reason}</p>}
        </div>
        <span className={`text-xs px-3 py-1 rounded-full ${st.cls}`}>{st.label}</span>
      </div>

      {/* Skor kartı */}
      <div className="bg-white border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-neutral-600">
            İlerleme: <strong>{score.eligibleVoters}/{score.voted}</strong> oy
            {!score.complete && <span className="text-neutral-400"> · tümü oy verince kesinleşir</span>}
          </div>
          <div className="text-sm">
            {score.scorePct != null ? (
              <span className="font-bold text-lg">%{score.scorePct} olumlu</span>
            ) : (
              <span className="text-neutral-400">henüz oy yok</span>
            )}
          </div>
        </div>
        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
          <div
            className={`h-full ${score.approved === false ? 'bg-red-400' : 'bg-green-500'}`}
            style={{ width: `${score.scorePct ?? 0}%` }}
          />
        </div>
        {score.complete && (
          <p className="text-sm mt-3 font-medium">
            {score.approved
              ? `✓ Skor %${score.thresholdPct}+ — reklama uygun. Meta veri hazırlığına geçebilir.`
              : `Skor %${score.thresholdPct} altında — reklama uygun bulunmadı.`}
          </p>
        )}
        <p className="text-xs text-neutral-400 mt-2">Eşik: %{score.thresholdPct} · {score.yes} evet / {score.no} hayır</p>
      </div>

      {/* Durum akışı — Meta otomasyonuna kadar manuel (yayınlandı/bitti) */}
      {['approved', 'meta_ready', 'published'].includes(row.status) && (
        <div className="bg-white border rounded-xl p-5 mb-6 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">Durum akışı:</span>
          {row.status === 'approved' && (
            <form action={advanceSuggestionStatusAction}>
              <input type="hidden" name="suggestionId" value={id} />
              <input type="hidden" name="status" value="meta_ready" />
              <button type="submit" className="h-9 px-4 rounded-full border-2 border-purple-500 text-purple-700 text-sm font-semibold hover:bg-purple-50">
                Meta verisi hazırlandı →
              </button>
            </form>
          )}
          {row.status === 'meta_ready' && (
            <form action={advanceSuggestionStatusAction}>
              <input type="hidden" name="suggestionId" value={id} />
              <input type="hidden" name="status" value="published" />
              <button type="submit" className="h-9 px-4 rounded-full border-2 border-green-600 text-green-700 text-sm font-semibold hover:bg-green-50">
                Yayınlandı olarak işaretle →
              </button>
            </form>
          )}
          {row.status === 'published' && (
            <form action={advanceSuggestionStatusAction}>
              <input type="hidden" name="suggestionId" value={id} />
              <input type="hidden" name="status" value="done" />
              <button type="submit" className="h-9 px-4 rounded-full border-2 border-neutral-400 text-neutral-700 text-sm font-semibold hover:bg-neutral-50">
                Bitti olarak işaretle →
              </button>
            </form>
          )}
        </div>
      )}

      {/* Video / işbirliği */}
      {(row.videoUrl || row.videoNote || row.collabType) && (
        <div className="bg-white border rounded-xl p-5 mb-6">
          <h2 className="font-bold mb-2">İçerik</h2>
          {row.collabType && (
            <p className="text-sm text-neutral-600">
              {row.collabType === 'existing_video' ? 'Hazır video' : 'İşbirliği önerisi (ürün hediye)'}
            </p>
          )}
          {row.videoUrl && (
            <a href={row.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">
              {row.videoUrl}
            </a>
          )}
          {row.videoNote && <p className="text-sm text-neutral-700 mt-1">{row.videoNote}</p>}
        </div>
      )}

      {/* Oy ver */}
      <div className="bg-white border rounded-xl p-5 mb-6">
        <h2 className="font-bold mb-3">Senin oyun</h2>
        <VoteForm suggestionId={id} currentVote={myVote} action={voteSuggestionAction} />
      </div>

      {/* Şeffaf oylar */}
      <div className="bg-white border rounded-xl p-5 mb-6">
        <h2 className="font-bold mb-3">Oylar ({votes.length})</h2>
        {votes.length === 0 ? (
          <p className="text-sm text-neutral-500">Henüz oy verilmedi.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {votes.map((v) => (
              <li key={v.userId} className="py-2 flex items-start gap-3">
                <span
                  className={`mt-0.5 text-xs px-2 py-0.5 rounded-full ${
                    v.vote === 'yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {v.vote === 'yes' ? 'Evet' : 'Hayır'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{v.voterName ?? '—'}</div>
                  {v.comment && <div className="text-sm text-neutral-600">{v.comment}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Influencer'lar */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-bold mb-3">Önerilen influencer'lar</h2>
        {linked.length === 0 ? (
          <p className="text-sm text-neutral-500 mb-3">Henüz influencer eklenmedi.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {linked.map((l) => (
              <a
                key={l.influencerId}
                href={l.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="border rounded-lg p-3 hover:border-neutral-400 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-neutral-100 grid place-items-center text-sm font-bold text-neutral-500">
                  {(l.displayName || l.handle).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">@{l.handle}</div>
                  <div className="text-xs text-neutral-500">
                    {l.followerCount != null ? `${l.followerCount.toLocaleString('tr-TR')} takipçi · ` : ''}
                    ekleyen: {l.addedBy ?? '—'}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {myVote === 'yes' ? (
          addableInfluencers.length > 0 ? (
            <AddInfluencerForm
              suggestionId={id}
              influencers={addableInfluencers}
              action={addInfluencerToSuggestionAction}
            />
          ) : (
            <p className="text-xs text-neutral-400">
              Eklenebilecek başka influencer yok.{' '}
              <Link href="/admin/influencers" className="text-blue-600 hover:underline">Yeni influencer ekle →</Link>
            </p>
          )
        ) : (
          <p className="text-xs text-neutral-400">
            Influencer eklemek için bu öneriye “evet” oyu vermelisin.
          </p>
        )}
      </div>
    </div>
  );
}
