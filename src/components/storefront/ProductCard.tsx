import Link from 'next/link';

interface ProductCardProps {
  handle: string;
  title: string;
  imageUrl?: string | null;
  vendorName?: string;
  priceCents: bigint | number | null;
  compareAtPriceCents?: bigint | number | null;
  isSoldOut?: boolean;
}

function formatTL(cents: bigint | number | null | undefined): string {
  if (cents == null) return '—';
  const n = Number(cents) / 100;
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ₺';
}

export function ProductCard({
  handle,
  title,
  imageUrl,
  vendorName,
  priceCents,
  compareAtPriceCents,
  isSoldOut,
}: ProductCardProps) {
  const hasDiscount =
    compareAtPriceCents != null &&
    priceCents != null &&
    Number(compareAtPriceCents) > Number(priceCents);

  return (
    <Link href={`/shop/${handle}`} className="product-card group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--color-brand-warm)] mb-4">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={title}
            className="product-card-img absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-brand-stone)] text-5xl">
            ⌂
          </div>
        )}

        {hasDiscount && !isSoldOut && (
          <div className="absolute top-3 left-3 bg-[var(--color-brand-orange)] text-white text-[10px] font-bold tracking-widest uppercase px-2.5 py-1">
            İndirim
          </div>
        )}
        {isSoldOut && (
          <div className="absolute top-3 left-3 bg-[var(--color-brand-ink)] text-white text-[10px] font-bold tracking-widest uppercase px-2.5 py-1">
            Tükendi
          </div>
        )}

        <div className="absolute inset-x-3 bottom-3 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
          <button
            type="button"
            className="w-full bg-[var(--color-brand-ink)] text-[var(--color-brand-cream)] text-[11px] font-bold tracking-[0.2em] uppercase py-3 hover:bg-[var(--color-brand-orange)] transition"
          >
            Hızlı İncele
          </button>
        </div>
      </div>

      <div className="px-1">
        {vendorName && (
          <div className="text-[10px] font-medium tracking-widest uppercase text-[var(--color-brand-clay)] mb-1.5">
            {vendorName}
          </div>
        )}
        <h3 className="font-serif text-lg md:text-xl leading-tight text-[var(--color-brand-ink)] mb-2 line-clamp-2">
          {title}
        </h3>
        <div className="flex items-baseline gap-3 text-sm">
          <span className="font-semibold text-[var(--color-brand-ink)]">
            {formatTL(priceCents)}
          </span>
          {hasDiscount && (
            <span className="text-[var(--color-brand-ink)]/40 line-through text-xs">
              {formatTL(compareAtPriceCents)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
