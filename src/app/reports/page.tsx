import Link from "next/link";
import { requireViewer } from "@/lib/access";
import { ministryLabel } from "@/lib/constants";
import { formatDateString, isDateString, manilaDateString } from "@/lib/date";
import { NO_MINISTRY, getMinistryServiceTable, getServiceDates } from "@/lib/reports";
import { MinistryName } from "@/components/MinistryName";
import { secondaryBtnCls } from "@/components/form";
import { DateSelect } from "./DateSelect";

/** "9AM - Mandurriao" → ["9AM", "Mandurriao"] */
const splitService = (s: string) => [s.split(" - ")[0], s.split(" - ")[1] ?? ""] as const;

export default async function MinistryServiceReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const viewer = await requireViewer();
  const { date: dateParam } = await searchParams;

  const dates = await getServiceDates(viewer.services);
  const today = manilaDateString();
  // Default: the latest day with check-ins (usually last Sunday), not today's empty one
  const date = isDateString(dateParam) ? dateParam : (dates.find((d) => d.date <= today)?.date ?? today);
  const table = await getMinistryServiceTable(date, viewer.services);

  // Dates are newest first: "previous" is the next entry, "next" the one before
  const index = dates.findIndex((d) => d.date === date);
  const older = index === -1 ? dates.find((d) => d.date < date) : dates[index + 1];
  const newer = index === -1 ? [...dates].reverse().find((d) => d.date > date) : dates[index - 1];

  const max = Math.max(1, ...table.rows.flatMap((r) => r.counts));

  const navCls =
    "flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-600 ring-1 ring-stone-200 transition hover:text-stm-brand hover:ring-stm-brand/40";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {older ? (
          <Link href={`/reports?date=${older.date}`} replace scroll={false} aria-label="Previous day with check-ins" className={navCls}>
            ‹
          </Link>
        ) : (
          <span className={`${navCls} opacity-40`} aria-hidden="true">‹</span>
        )}
        <DateSelect dates={dates} value={date} />
        {newer ? (
          <Link href={`/reports?date=${newer.date}`} replace scroll={false} aria-label="Next day with check-ins" className={navCls}>
            ›
          </Link>
        ) : (
          <span className={`${navCls} opacity-40`} aria-hidden="true">›</span>
        )}
        <div className="ml-auto">
          <a
            href={`/reports/export?date=${date}`}
            download
            aria-disabled={table.total === 0}
            className={`${secondaryBtnCls} ${table.total === 0 ? "pointer-events-none opacity-50" : ""}`}
          >
            Download Excel
          </a>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-stone-200/80 shadow-sm">
        <div className="px-5 pt-5 pb-3">
          <h2 className="font-bold text-stone-900">STMs who served · {formatDateString(date)}</h2>
          <p className="text-xs text-stone-500">
            {table.total} STM{table.total === 1 ? "" : "s"} checked in. Someone in several ministries counts in each row; totals
            count each person once.
          </p>
        </div>

        {table.total === 0 ? (
          <p className="px-5 pb-6 text-sm text-stone-400">No service check-ins on this day.</p>
        ) : (
          <div className="overflow-x-auto">
            {/* Fixed layout: every service column the same width; scrolls sideways on phones */}
            <table className="w-full min-w-[44rem] table-fixed text-sm">
              <colgroup>
                <col className="w-44" />
                {table.services.map((s) => (
                  <col key={s} />
                ))}
                <col className="w-20" />
              </colgroup>
              <thead>
                <tr className="border-y border-stone-200 bg-stone-50 text-xs text-stone-500">
                  <th scope="col" className="sticky left-0 bg-stone-50 px-4 py-2.5 text-left font-semibold uppercase tracking-wide">
                    Ministry
                  </th>
                  {table.services.map((s) => {
                    const [time, place] = splitService(s);
                    return (
                      <th key={s} scope="col" className="px-2 py-2.5 text-center font-semibold whitespace-nowrap">
                        <span className="block text-sm text-stone-800">{time}</span>
                        <span className="block font-normal">{place}</span>
                      </th>
                    );
                  })}
                  <th scope="col" className="px-4 py-2.5 text-center font-semibold uppercase tracking-wide">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {table.rows.map((r) => (
                  <tr key={r.ministry}>
                    <th scope="row" className="sticky left-0 bg-white px-4 py-2 text-left font-medium text-stone-700 whitespace-nowrap">
                      {r.ministry === NO_MINISTRY ? <span className="text-stone-400">{r.ministry}</span> : <MinistryName ministry={r.ministry} />}
                    </th>
                    {r.counts.map((n, i) => (
                      <td key={table.services[i]} className="px-1.5 py-1.5 text-center">
                        <HeatCell value={n} max={max} title={`${ministryLabel(r.ministry)} · ${table.services[i]}: ${n} STM${n === 1 ? "" : "s"}`} />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center font-semibold tabular-nums text-stone-900">{r.total || <span className="text-stone-300">–</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-200 bg-stone-50">
                  <th scope="row" className="sticky left-0 bg-stone-50 px-4 py-2.5 text-left font-bold text-stone-900">
                    Total STMs
                  </th>
                  {table.serviceTotals.map((n, i) => (
                    <td key={table.services[i]} className="px-2 py-2.5 text-center font-bold tabular-nums text-stone-900">
                      {n || <span className="font-normal text-stone-300">–</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-center text-base font-extrabold tabular-nums text-stm-brand">{table.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// Sequential teal in five steps (more STMs → darker). The ramp skips the middle band where
// neither white nor dark text reads well: light steps carry dark ink, dark steps white text.
// Contrast (computed): 14.8, 11.3, 8.2 (ink) · 5.5, 11.7 (white) — all ≥ 4.5:1.
const HEAT_STEPS = [
  { bg: "#e2efee", text: "#1c1917" },
  { bg: "#b7d6d4", text: "#1c1917" },
  { bg: "#87bbb7", text: "#1c1917" },
  { bg: "var(--color-stm-brand)", text: "#ffffff" },
  { bg: "var(--color-stm-brand-dark)", text: "#ffffff" },
];

function HeatCell({ value, max, title }: { value: number; max: number; title: string }) {
  if (value === 0) return <span className="block rounded-lg py-1.5 text-stone-300" title={title}>–</span>;
  const step = HEAT_STEPS[Math.min(HEAT_STEPS.length - 1, Math.ceil((value / max) * HEAT_STEPS.length) - 1)];
  return (
    <span
      title={title}
      className="block rounded-lg py-1.5 font-semibold tabular-nums"
      style={{ backgroundColor: step.bg, color: step.text }}
    >
      {value}
    </span>
  );
}
