"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { addMonths, formatShortDate } from "@/lib/date";

const monthBtnCls =
  "rounded-full border border-stone-300 bg-white px-3.5 py-2 text-sm font-semibold text-stone-600 transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed";

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", weekday: "short" });
const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", month: "long", year: "numeric" });

/**
 * Sunday Attendance date picker: one month at a time (← / month input / →, never past the
 * current month) and a card per date in it that has check-ins; clicking a card selects it.
 * The page below (`children`) dims while the next month or date loads.
 */
export function AttendanceMonthNav({
  month,
  currentMonth,
  dates,
  selected,
  keep,
  children,
}: {
  /** "YYYY-MM" being shown */
  month: string;
  currentMonth: string;
  /** Dates in `month` with check-ins (oldest first) and their check-in counts */
  dates: { date: string; total: number }[];
  selected?: string;
  /** Other query params to carry on every link (filters, sort), e.g. "&ministry=Music". */
  keep: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (query: string) => startTransition(() => router.push(`/attendance?${query}${keep}`, { scroll: false }));
  const goMonth = (m: string) => go(`month=${m}`);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => goMonth(addMonths(month, -1))} className={monthBtnCls} aria-label="Previous month">
            ←
          </button>
          <input
            type="month"
            value={month}
            max={currentMonth}
            aria-label="Month"
            onChange={(e) => e.target.value && goMonth(e.target.value)}
            className="rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-stone-700 focus:outline-none focus:ring-4 focus:ring-stm-brand/15 focus:border-stm-brand"
          />
          <button
            type="button"
            onClick={() => goMonth(addMonths(month, 1))}
            disabled={month >= currentMonth}
            className={monthBtnCls}
            aria-label="Next month"
          >
            →
          </button>
          {month !== currentMonth && (
            <button type="button" onClick={() => goMonth(currentMonth)} className="text-sm font-semibold text-stm-brand hover:underline px-2">
              This month
            </button>
          )}
          {pending && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-stm-brand">
              <span className="size-3.5 rounded-full border-2 border-stm-brand/30 border-t-stm-brand animate-spin" />
              Loading…
            </span>
          )}
        </div>

        {dates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
            No check-ins recorded in {monthLabel(month)}.
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dates.map((d) => {
              const active = d.date === selected;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => go(`date=${d.date}`)}
                  aria-current={active || undefined}
                  className={`shrink-0 flex flex-col items-center gap-0.5 rounded-2xl border px-4 py-2.5 transition active:scale-95 ${
                    active
                      ? "border-stm-brand bg-stm-brand text-white shadow-sm"
                      : "border-stone-200/80 bg-white text-stone-700 shadow-sm hover:border-stm-brand/40 hover:text-stm-brand"
                  }`}
                >
                  <span className={`text-xs ${active ? "text-white/80" : "text-stone-500"}`}>{weekday(d.date)}</span>
                  <span className="text-sm font-bold whitespace-nowrap">{formatShortDate(d.date)}</span>
                  <span className={`text-xs whitespace-nowrap ${active ? "text-white/80" : "text-stm-green font-semibold"}`}>
                    {d.total} check-in{d.total === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className={`flex flex-col gap-6 transition-opacity ${pending ? "opacity-40 pointer-events-none" : ""}`}>{children}</div>
    </div>
  );
}
