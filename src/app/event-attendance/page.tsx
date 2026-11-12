import Link from "next/link";
import { requireViewer } from "@/lib/access";
import {
  getDefaultEventDate,
  getEventAttendance,
  getEventCheckInCountsByDate,
  getRecentEventDates,
  isKindFilter,
  KIND_FILTERS,
  type KindFilter,
} from "@/lib/attendance";
import { EVENT_SORTS, filterLabel, matchesFilter, parseAttendanceSort, prepareRows } from "@/lib/attendance-table";
import { MINISTRY_OPTIONS } from "@/lib/constants";
import { addMonths, formatDateString, isDateString, isMonthString, manilaDateString } from "@/lib/date";
import { StatCard } from "@/components/StatCard";
import { secondaryBtnCls } from "@/components/form";
import { AttendanceCalendar } from "@/app/attendance/AttendanceCalendar";
import { AttendanceTable, FilterChips, RecentDates, attendanceHref, type AttendanceParams } from "@/app/attendance/AttendanceParts";

const BASE = "/event-attendance";

/**
 * Who came to the events on a date — STMs, leaders and pastors & staff, with walk-ins. One
 * full-width table per event (usually just one a day), stacked. Church-wide: not limited by the
 * viewer's service group (like the events themselves).
 */
export default async function EventAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string; ministry?: string; sort?: string; dir?: string }>;
}) {
  await requireViewer();

  const sp = await searchParams;
  const today = manilaDateString();
  // Opens on today's events, else the latest past event, else the next one
  const date = isDateString(sp.date) ? sp.date : await getDefaultEventDate(today);
  const month = isMonthString(sp.month) ? sp.month : date.slice(0, 7);
  const lastOfMonth = new Date(`${addMonths(month, 1)}-01T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000;
  // A ministry (STMs), or "leaders" / "staff"
  const filter = (MINISTRY_OPTIONS as readonly string[]).includes(sp.ministry ?? "") || isKindFilter(sp.ministry) ? sp.ministry! : "";
  const { sort, dir } = parseAttendanceSort(sp.sort, sp.dir, EVENT_SORTS);

  const current: AttendanceParams = { date, ministry: filter, sort, dir };
  const href = (next: Partial<AttendanceParams> & { month?: string }) => attendanceHref(BASE, current, next);
  const keep = href({}).replace(/^\/event-attendance\?date=[^&]*/, "");

  const [dayEvents, recentDates, calendarCounts] = await Promise.all([
    getEventAttendance(date),
    getRecentEventDates(filter || undefined),
    getEventCheckInCountsByDate(`${month}-01`, new Date(lastOfMonth).toISOString().slice(0, 10), filter || undefined),
  ]);

  const all = dayEvents.flatMap((e) => e.rows);
  const countOf = (f: string) => new Set(all.filter((r) => matchesFilter(r, f)).map((r) => r.key)).size;
  const chips = [
    ...MINISTRY_OPTIONS.map((m) => ({ value: m as string, label: m, count: countOf(m) })),
    ...(Object.keys(KIND_FILTERS) as KindFilter[]).map((k) => ({ value: k as string, label: KIND_FILTERS[k], count: countOf(k) })),
  ];

  const tables = dayEvents.map(({ event, rows }) => ({ event, rows: prepareRows(rows, filter, sort, dir) }));
  const shown = tables.flatMap((t) => t.rows);
  const people = new Set(shown.map((r) => r.key)).size;
  const walkIns = shown.filter((r) => r.isWalkIn).length;
  const showWalkIns = dayEvents.some((e) => e.event.preRegistration);
  const filterNote = filter ? `${filterLabel(filter)} only` : undefined;
  // One event (the usual case): the table needs no title bar, the stats above already say it all
  const single = tables.length === 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-[1fr_auto] content-start">
        <div className="sm:col-start-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Event Attendance</h1>
          <p className="text-sm text-stone-500">{formatDateString(date)}</p>
        </div>

        <div className="sm:col-start-2 sm:row-start-1 sm:row-span-2">
          <AttendanceCalendar month={month} selected={date} today={today} counts={calendarCounts} keep={keep} basePath={BASE} />
        </div>

        <div className="sm:col-start-1 flex flex-col gap-6 min-w-0">
          <RecentDates label="Event dates:" dates={recentDates} selected={date} href={(d) => href({ date: d })} />

          <div className={`grid gap-4 grid-cols-2 ${showWalkIns ? "lg:grid-cols-3" : ""}`}>
            <StatCard label="Check-ins" value={shown.length} hint={filterNote} />
            <StatCard label="People" value={people} hint={filterNote ?? "Counted once across events"} />
            {showWalkIns && <StatCard label="Walk-ins" value={walkIns} hint={filterNote ?? "Not pre-registered"} />}
          </div>

          {dayEvents.length > 0 && (
            <FilterChips allCount={new Set(all.map((r) => r.key)).size} items={chips} selected={filter} href={(f) => href({ ministry: f })} />
          )}
        </div>
      </div>

      {dayEvents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">
          No events on this date.{" "}
          <Link href="/events" className="text-stm-brand underline">
            See all events
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="min-w-0 text-sm font-semibold uppercase tracking-wide text-stone-500">
              {single ? (
                <Link href={`/events/${tables[0].event.id}`} className="normal-case tracking-normal text-base font-bold text-stone-900 hover:text-stm-brand hover:underline">
                  {tables[0].event.name}
                </Link>
              ) : (
                "Check-ins"
              )}
              {filterNote && <span className="normal-case tracking-normal font-normal"> · {filterNote}</span>}
            </h2>
            <a
              href={attendanceHref(`${BASE}/export`, current)}
              download
              aria-disabled={shown.length === 0}
              className={`${secondaryBtnCls} ${shown.length === 0 ? "pointer-events-none opacity-50" : ""}`}
            >
              Download Excel
            </a>
          </div>
          {tables.map(({ event, rows }) => (
            <AttendanceTable
              key={event.id}
              title={single ? undefined : event.name}
              href={single ? undefined : `/events/${event.id}`}
              rows={rows}
              filter={filter}
              sort={sort}
              dir={dir}
              columns={EVENT_SORTS}
            />
          ))}
        </div>
      )}
    </div>
  );
}
