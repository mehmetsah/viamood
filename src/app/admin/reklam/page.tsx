import { count, desc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { adSuggestionVotes, adSuggestions, products, users } from '@/db/schema';
import { adminCreateSuggestionAction } from '@/lib/actions/ads';
import { countEligibleVoters } from '@/lib/ads/scoring';
import { NewSuggestionForm } from './NewSuggestionForm';

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Oylama sürüyor', cls: 'bg-blue-100 text-blue-800' },
  scored: { label: 'Skorlandı', cls: 'bg-neutral-200 text-neutral-700' },
  approved: { label: 'Reklama uygun', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Uygun değil', cls: 'bg-red-100 text-red-700' },
  meta_ready: { label: 'Meta hazır', cls: 'bg-purple-100 text-purple-800' },
  published: { label: 'Yayınlandı', cls: 'bg-green-100 text-green-800' },
  done: { label: 'Tamamlandı', cls: 'bg-neutral-200 text-neutral-700' },
};

export default async function AdminReklamPage() {
  const eligibleVoters = await countEligibleVoters();

  const rows = await db
    .select({
      id: adSuggestions.id,
      status: adSuggestions.status,
      productTitle: products.title,
      productImage: products.featuredImageUrl,
      proposer: users.name,
    })
    .from(adSuggestions)
    .innerJoin(products, eq(adSuggestions.productId, products.id))
    .leftJoin(users, eq(adSuggestions.suggestedByUserId, users.id))
    .orderBy(desc(adSuggestions.createdAt));

  const agg = await db
    .select({
      suggestionId: adSuggestionVotes.suggestionId,
      total: count(),
      yes: sql<number>`count(*) filter (where ${adSuggestionVotes.vote} = 'yes')`,
    })
    .from(adSuggestionVotes)
    .groupBy(adSuggestionVotes.suggestionId);
  const aggMap = new Map(agg.map((a) => [a.suggestionId, a]));

  const productOptions = await db
    .select({ id: products.id, title: products.title })
    .from(products)
    .where(eq(products.status, 'active'))
    .orderBy(products.title)
    .limit(500);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Reklam Önerileri</h1>
      <p className="text-sm text-neutral-600 mb-6">
        İddialı ürünleri reklama öner; herkes evet/hayır oy verir. Şu an{' '}
        <strong>{eligibleVoters}</strong> kişi oy hakkına sahip. Herkes oy verince skor kesinleşir;{' '}
        <strong>%60+</strong> olumlu olan ürün reklama uygun sayılır.
      </p>

      <NewSuggestionForm products={productOptions} action={adminCreateSuggestionAction} />

      <div className="mt-8 flex flex-col gap-3">
        {rows.length === 0 && (
          <div className="bg-white border rounded-xl p-10 text-center text-neutral-500">
            Henüz öneri yok. Yukarıdan ilk öneriyi ekle.
          </div>
        )}
        {rows.map((r) => {
          const a = aggMap.get(r.id);
          const voted = Number(a?.total ?? 0);
          const yes = Number(a?.yes ?? 0);
          const livePct = voted > 0 ? Math.round((yes / voted) * 100) : null;
          const st = STATUS[r.status] ?? { label: r.status, cls: 'bg-neutral-200 text-neutral-700' };
          return (
            <Link
              key={r.id}
              href={`/admin/reklam/${r.id}`}
              className="bg-white border rounded-xl p-4 flex items-center gap-4 hover:border-neutral-400 transition"
            >
              {r.productImage ? (
                <img src={r.productImage} alt="" className="w-14 h-14 rounded-lg object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-neutral-100" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.productTitle}</div>
                <div className="text-xs text-neutral-500">Öneren: {r.proposer ?? '—'}</div>
              </div>
              <div className="text-sm text-neutral-600 whitespace-nowrap">
                {eligibleVoters}/{voted} oy
                {livePct != null && <span className="ml-2 font-semibold">%{livePct}</span>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
