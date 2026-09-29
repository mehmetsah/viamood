import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db/client';
import { influencers, users } from '@/db/schema';
import { adminCreateInfluencerAction } from '@/lib/actions/ads';
import { NewInfluencerForm } from './NewInfluencerForm';

export default async function AdminInfluencersPage() {
  const adder = alias(users, 'adder');
  const rows = await db
    .select({
      id: influencers.id,
      handle: influencers.handle,
      displayName: influencers.displayName,
      instagramUrl: influencers.instagramUrl,
      followerCount: influencers.followerCount,
      notes: influencers.notes,
      addedBy: adder.name,
    })
    .from(influencers)
    .leftJoin(adder, eq(influencers.addedByUserId, adder.id))
    .orderBy(desc(influencers.createdAt));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Influencer&apos;lar</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Etkileşim yapabilecek influencer&apos;lar. İstatistik için karttaki linke tıkla — Instagram&apos;da
        açılır (takipçi ve son postlar orada). Takipçi sayısı elle girilir. Ürün önerilerine buradan
        influencer eklenir; kimin eklediği kaydedilir.
      </p>

      <NewInfluencerForm action={adminCreateInfluencerAction} />

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.length === 0 && (
          <div className="col-span-full bg-white border rounded-xl p-10 text-center text-neutral-500">
            Henüz influencer yok. Yukarıdan ekle.
          </div>
        )}
        {rows.map((r) => (
          <a
            key={r.id}
            href={r.instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-white border rounded-xl p-5 hover:border-neutral-400 transition flex flex-col gap-2"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-neutral-100 grid place-items-center font-bold text-neutral-500">
                {(r.displayName || r.handle).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">@{r.handle}</div>
                {r.displayName && <div className="text-xs text-neutral-500 truncate">{r.displayName}</div>}
              </div>
            </div>
            <div className="text-sm">
              {r.followerCount != null ? (
                <strong>{r.followerCount.toLocaleString('tr-TR')}</strong>
              ) : (
                '—'
              )}{' '}
              <span className="text-neutral-500">takipçi</span>
            </div>
            {r.notes && <p className="text-xs text-neutral-600 line-clamp-2">{r.notes}</p>}
            <div className="text-xs text-neutral-400 mt-auto pt-2">
              Ekleyen: {r.addedBy ?? '—'} · Profili aç ↗
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
