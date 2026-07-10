import Link from 'next/link';

/**
 * Eşik-üstü sayfalama. total ≤ pageSize ise HİÇBİR ŞEY render etmez (istenen davranış).
 * Link tabanlı (?p=), server component — JS gerektirmez.
 */
export function Pagination({
  total,
  page,
  pageSize,
  basePath,
}: {
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
}) {
  const sayfaSayisi = Math.ceil(total / pageSize);
  if (sayfaSayisi <= 1) return null;

  const url = (p: number) => (p <= 1 ? basePath : `${basePath}?p=${p}`);

  // görünecek sayfa numaraları (kenarlar + geçerli çevresi, aradakiler …)
  const set = new Set<number>([1, sayfaSayisi, page, page - 1, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= sayfaSayisi).sort((a, b) => a - b);

  const parcalar: (number | 'dots')[] = [];
  let onceki = 0;
  for (const n of nums) {
    if (onceki && n - onceki > 1) parcalar.push('dots');
    parcalar.push(n);
    onceki = n;
  }

  return (
    <nav className="vh-sayfalama" aria-label="Sayfalama">
      {page > 1 ? (
        <Link href={url(page - 1)} aria-label="Önceki sayfa">
          ‹
        </Link>
      ) : (
        <span className="pasif" aria-hidden="true">
          ‹
        </span>
      )}

      {parcalar.map((p, i) =>
        p === 'dots' ? (
          <span key={`d${i}`} className="nokta" aria-hidden="true">
            …
          </span>
        ) : p === page ? (
          <span key={p} className="simdi" aria-current="page">
            {p}
          </span>
        ) : (
          <Link key={p} href={url(p)}>
            {p}
          </Link>
        ),
      )}

      {page < sayfaSayisi ? (
        <Link href={url(page + 1)} aria-label="Sonraki sayfa">
          ›
        </Link>
      ) : (
        <span className="pasif" aria-hidden="true">
          ›
        </span>
      )}
    </nav>
  );
}

/** ?p= parametresini güvenli sayfa numarasına çevirir. */
export function parsePage(sp: Record<string, string | string[] | undefined>): number {
  const raw = Array.isArray(sp.p) ? sp.p[0] : sp.p;
  const n = parseInt(raw ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
