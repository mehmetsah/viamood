import Link from 'next/link';

interface PaginationProps {
  /** Toplam kayıt sayısı (filtre uygulanmış) */
  totalCount: number;
  /** Mevcut sayfa (1-tabanlı) */
  currentPage: number;
  /** Sayfa başına satır */
  pageSize: number;
  /** Mevcut search params (filtre vs.) — URL'leri korumak için */
  searchParams: Record<string, string | undefined>;
  /** Sayfa parametresi adı (default "page") */
  paramName?: string;
}

export function Pagination({
  totalCount,
  currentPage,
  pageSize,
  searchParams,
  paramName = 'page',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const buildHref = (page: number): string => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== paramName) params.set(k, v);
    }
    if (page > 1) params.set(paramName, String(page));
    const s = params.toString();
    return s ? `?${s}` : '?';
  };

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  // Page numbers window: ilk, son, ve current ± 1
  const window = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const pages = [...window].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  return (
    <nav
      className="flex items-center justify-between px-4 py-3 border-t bg-neutral-50 text-sm"
      aria-label="Sayfa gezinme"
    >
      <div className="text-neutral-600">
        <span className="font-semibold">{start}</span>–
        <span className="font-semibold">{end}</span> /{' '}
        <span className="font-semibold">{totalCount}</span>
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={buildHref(currentPage - 1)}
          aria-disabled={currentPage === 1}
          className={`px-3 py-1.5 rounded border text-xs font-semibold ${
            currentPage === 1
              ? 'pointer-events-none opacity-40 bg-neutral-100'
              : 'hover:bg-neutral-100'
          }`}
        >
          ← Önceki
        </Link>
        {pages.map((p, i) => {
          const prev = pages[i - 1];
          const showGap = prev != null && p - prev > 1;
          return (
            <span key={p} className="flex items-center">
              {showGap && <span className="px-1 text-neutral-400">…</span>}
              <Link
                href={buildHref(p)}
                className={`px-3 py-1.5 rounded border text-xs font-semibold ${
                  p === currentPage
                    ? 'bg-black text-white border-black'
                    : 'hover:bg-neutral-100'
                }`}
              >
                {p}
              </Link>
            </span>
          );
        })}
        <Link
          href={buildHref(currentPage + 1)}
          aria-disabled={currentPage === totalPages}
          className={`px-3 py-1.5 rounded border text-xs font-semibold ${
            currentPage === totalPages
              ? 'pointer-events-none opacity-40 bg-neutral-100'
              : 'hover:bg-neutral-100'
          }`}
        >
          Sonraki →
        </Link>
      </div>
    </nav>
  );
}

/** Pagination için yardımcı: searchParams.page'i 1-tabanlı integer'a dönüştür */
export function parsePage(raw: string | undefined, max = 100000): number {
  if (!raw) return 1;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, max);
}
