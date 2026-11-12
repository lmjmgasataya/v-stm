import Link from "next/link";
import { formatDateString } from "@/lib/date";

/** How many service dates the trend shows. */
const WINDOW = 10;

/** "2026-11-08" → "Nov 8" */
const shortDate = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", month: "short", day: "numeric" });

/**
 * STMs who served (distinct people) over the last service dates, oldest → newest. One series,
 * so no legend: the heading names it. Each bar opens that date's table; the selected date is
 * the solid bar with its count shown, others show theirs on hover.
 */
export function SundayTrend({ dates, selected }: { dates: { date: string; total: number }[]; selected: string }) {
  // `dates` is newest first. Keep the selected date in view when it's older than the window.
  const index = dates.findIndex((d) => d.date === selected);
  const start = index < WINDOW ? 0 : index - Math.floor(WINDOW / 2);
  const points = dates.slice(start, start + WINDOW).reverse();
  if (points.length < 2) return null;

  const max = Math.max(1, ...points.map((p) => p.total));
  const current = points.find((p) => p.date === selected);
  const previous = current ? points[points.indexOf(current) - 1] : undefined;
  const delta = current && previous ? current.total - previous.total : null;

  return (
    <section className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="font-bold text-stone-900">STMs who served per Sunday</h2>
          <p className="text-xs text-stone-500">Last {points.length} days with check-ins · each person counted once a day</p>
        </div>
        {delta !== null && (
          <p className="text-sm text-stone-500">
            <span className="font-semibold text-stone-800">
              {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : "No change"}
            </span>{" "}
            vs {shortDate(previous!.date)}
          </p>
        )}
      </div>

      <ol className="mt-5 flex h-36 items-stretch gap-0.5" aria-label="STMs who served per Sunday">
        {points.map((p) => {
          const active = p.date === selected;
          const label = `${formatDateString(p.date)}: ${p.total} STM${p.total === 1 ? "" : "s"}`;
          return (
            <li key={p.date} className="flex min-w-0 flex-1">
              <Link
                href={`/reports?date=${p.date}`}
                replace
                scroll={false}
                aria-label={label}
                aria-current={active ? "date" : undefined}
                title={label}
                className="group flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-lg px-0.5 focus-visible:outline-2 focus-visible:outline-stm-brand"
              >
                {/* Plot area: the value sits on top of its bar, bars grow up from the baseline */}
                <span className="flex w-full flex-1 flex-col items-center justify-end border-b border-stone-200">
                  <span
                    className={`text-xs font-semibold tabular-nums text-stone-700 ${
                      active ? "" : "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    }`}
                  >
                    {p.total}
                  </span>
                  <span
                    className={`mt-1 w-full max-w-8 rounded-t-[4px] transition-colors ${
                      active ? "bg-stm-brand" : "bg-[#b7d6d4] group-hover:bg-[#87bbb7]"
                    }`}
                    // Tallest bar at 85% leaves room for its value above it
                    style={{ height: `${Math.max(2, (p.total / max) * 85)}%` }}
                  />
                </span>
                <span
                  className={`max-w-full truncate text-[11px] tabular-nums ${active ? "font-semibold text-stone-900" : "text-stone-500"}`}
                >
                  {shortDate(p.date)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
