// Horizontal bar list for one-series breakdowns (a count per category). One hue — the
// bars compare magnitude, so no legend: the card title names the series. Values sit at
// each bar's tip in text colors (never the bar color); "Not set"-style rows are muted.

/** Space kept after the longest bar for its "31 52%" label. */
const LABEL_ROOM = "5.25rem";

export interface BarRow {
  label: React.ReactNode;
  /** Plain-text label for the tooltip and screen readers. */
  text: string;
  value: number;
  /** De-emphasised row, e.g. "Not set". */
  muted?: boolean;
}

export function BarList({ rows, total, unit = "member" }: { rows: BarRow[]; total: number; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const pct = (value: number) => (total ? Math.round((value / total) * 100) : 0);
  const plural = (n: number) => `${n.toLocaleString()} ${unit}${n === 1 ? "" : "s"}`;

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li
          key={row.text}
          tabIndex={0}
          aria-label={`${row.text}: ${plural(row.value)}, ${pct(row.value)}%`}
          className="group relative grid grid-cols-[minmax(6rem,9.5rem)_1fr] items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-stm-brand/40"
        >
          <span className={`truncate text-sm ${row.muted ? "text-stone-400" : "text-stone-700"}`}>{row.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            {/* Grows from the baseline; 4px rounded data-end, square at the base. The longest
                bar leaves LABEL_ROOM for its value, so the label at the tip never overflows. */}
            <span
              className={`h-4 shrink-0 rounded-r-[4px] transition-[width] duration-500 ${
                row.muted ? "bg-stone-300" : "bg-stm-brand group-hover:bg-stm-brand-dark"
              }`}
              style={{ width: row.value ? `max(2px, calc((100% - ${LABEL_ROOM}) * ${row.value / max}))` : 0 }}
              aria-hidden="true"
            />
            <span className="shrink-0 text-sm tabular-nums">
              <span className="font-semibold text-stone-900">{row.value.toLocaleString()}</span>{" "}
              <span className="text-stone-400">{pct(row.value)}%</span>
            </span>
          </span>
          {/* Hover/focus tooltip */}
          <span
            role="tooltip"
            className="pointer-events-none absolute left-[9.5rem] -top-9 z-10 whitespace-nowrap rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {row.text} · {plural(row.value)} · {pct(row.value)}%
          </span>
        </li>
      ))}
    </ul>
  );
}
