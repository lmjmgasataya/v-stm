import Link from "next/link";
import { addMonths } from "@/lib/date";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Month grid for picking a date. Days with check-ins are bold with their count, so you can
 * see at a glance which dates have data. ‹ › browse months via `?month=` while keeping the
 * selected `?date=`; clicking a day selects it.
 */
export function AttendanceCalendar({
  month,
  selected,
  today,
  counts,
  keep = "",
}: {
  /** "YYYY-MM" being shown */
  month: string;
  /** "YYYY-MM-DD" whose attendance is on the page */
  selected: string;
  today: string;
  counts: Map<string, number>;
  /** Other query params to carry on every link (ministry filter, sort), e.g. "&ministry=Music". */
  keep?: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const leadingBlanks = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });

  const days = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const activeDays = days.filter((d) => counts.has(d));
  const monthTotal = activeDays.reduce((sum, d) => sum + counts.get(d)!, 0);
  const monthHref = (delta: number) => `/attendance?date=${selected}&month=${addMonths(month, delta)}${keep}`;
  const navCls = "rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-stm-navy transition";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 w-full sm:w-80">
      <div className="flex items-center justify-between mb-3">
        <Link href={monthHref(-1)} replace scroll={false} aria-label="Previous month" className={navCls}>
          ‹
        </Link>
        <p className="font-semibold text-gray-900">{monthLabel}</p>
        <Link href={monthHref(1)} replace scroll={false} aria-label="Next month" className={navCls}>
          ›
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-[11px] font-medium uppercase text-gray-400 pb-1">
            {d}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const count = counts.get(day);
          const isSelected = day === selected;
          return (
            <Link
              key={day}
              href={`/attendance?date=${day}${keep}`}
              replace
              scroll={false}
              aria-current={isSelected ? "date" : undefined}
              title={count ? `${count} check-in${count === 1 ? "" : "s"}` : "No check-ins"}
              className={`flex h-10 flex-col items-center justify-center rounded-lg text-sm leading-none transition ${
                isSelected
                  ? "bg-stm-navy text-white"
                  : count
                    ? "bg-stm-green/10 font-bold text-stm-navy hover:bg-stm-green/20"
                    : "text-gray-400 hover:bg-gray-100"
              } ${day === today && !isSelected ? "ring-1 ring-stm-navy/40" : ""}`}
            >
              {Number(day.slice(8))}
              {count ? (
                <span className={`mt-0.5 text-[10px] font-semibold ${isSelected ? "text-white/80" : "text-stm-green"}`}>
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          {activeDays.length
            ? `${monthTotal} check-in${monthTotal === 1 ? "" : "s"} on ${activeDays.length} day${activeDays.length === 1 ? "" : "s"}`
            : "No check-ins this month"}
        </span>
        {selected !== today && (
          <Link href={`/attendance?date=${today}${keep}`} replace scroll={false} className="font-semibold text-stm-navy hover:underline">
            Today
          </Link>
        )}
      </div>
    </div>
  );
}
