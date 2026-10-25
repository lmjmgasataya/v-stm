import Link from "next/link";

/** Page numbers to show: first, last, and a window around the current page, with gaps as null. */
function pageList(page: number, pageCount: number): (number | null)[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? [null, n] : [n]));
}

/** Server-rendered pager; `query` is the list's other params (filters, sort) to keep on every link. */
export function Pagination({ page, pageCount, query }: { page: number; pageCount: number; query: string }) {
  if (pageCount <= 1) return null;
  const href = (n: number) => `/members?${query ? `${query}&` : ""}page=${n}`;
  const btn = "flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-semibold transition";

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} className={`${btn} bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stm-brand`}>
          ‹ Prev
        </Link>
      ) : (
        <span className={`${btn} text-stone-300`}>‹ Prev</span>
      )}
      {pageList(page, pageCount).map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`} className="px-1 text-stone-400">
            …
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            aria-current={n === page ? "page" : undefined}
            className={`${btn} ${
              n === page ? "bg-stm-brand text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stm-brand"
            }`}
          >
            {n}
          </Link>
        )
      )}
      {page < pageCount ? (
        <Link href={href(page + 1)} className={`${btn} bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stm-brand`}>
          Next ›
        </Link>
      ) : (
        <span className={`${btn} text-stone-300`}>Next ›</span>
      )}
    </nav>
  );
}
