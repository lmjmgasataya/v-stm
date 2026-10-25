import Link from "next/link";
import { requireViewer } from "@/lib/access";
import {
  getAttendanceByService,
  getCheckInCountsByDate,
  getRecentServiceDates,
  type AttendanceRow,
} from "@/lib/attendance";
import { MINISTRY_OPTIONS, ministryLabel, ministryList } from "@/lib/constants";
import { MinistryName } from "@/components/MinistryName";
import { addMonths, formatDateString, formatTime, isDateString, isMonthString, manilaDateString } from "@/lib/date";
import { memberDisplayName } from "@/lib/members";
import { parseSort, type SortDir } from "@/lib/sort";
import { StatCard } from "@/components/StatCard";
import { AttendanceCalendar } from "./AttendanceCalendar";

const SORTS = { last: "Last name", first: "First name", time: "Check-in time" } as const;
type SortKey = keyof typeof SORTS;
const SORT_KEYS = Object.keys(SORTS) as SortKey[];

const byText = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });
const COMPARE: Record<SortKey, (a: AttendanceRow, b: AttendanceRow) => number> = {
  last: (a, b) => byText(a.lastName, b.lastName) || byText(a.firstName, b.firstName),
  first: (a, b) => byText(a.firstName, b.firstName) || byText(a.lastName, b.lastName),
  time: (a, b) => a.checkedInAt.getTime() - b.checkedInAt.getTime() || byText(a.lastName, b.lastName),
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string; ministry?: string; sort?: string; dir?: string }>;
}) {
  const viewer = await requireViewer();

  const sp = await searchParams;
  const today = manilaDateString();
  const date = isDateString(sp.date) ? sp.date : today;
  // ?month= only while browsing the calendar; otherwise show the selected date's month
  const month = isMonthString(sp.month) ? sp.month : date.slice(0, 7);
  const lastOfMonth = new Date(`${addMonths(month, 1)}-01T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000;
  const ministry = (MINISTRY_OPTIONS as readonly string[]).includes(sp.ministry ?? "") ? sp.ministry! : "";
  const { sort, dir } = parseSort(sp.sort, sp.dir, SORT_KEYS, "last");

  // Builds an attendance link that keeps the current filter/sort unless overridden
  function href(next: { date?: string; month?: string; ministry?: string; sort?: SortKey; dir?: SortDir }) {
    const params = new URLSearchParams({ date: next.date ?? date });
    if (next.month) params.set("month", next.month);
    const m = next.ministry ?? ministry;
    if (m) params.set("ministry", m);
    const s = next.sort ?? sort;
    const d = next.dir ?? dir;
    if (s !== "last" || d !== "asc") params.set("sort", s);
    if (d !== "asc") params.set("dir", d);
    return `/attendance?${params.toString()}`;
  }
  const keep = href({}).replace(/^\/attendance\?date=[^&]*/, ""); // "&ministry=…&sort=…" for the calendar

  const [services, recentDates, calendarCounts] = await Promise.all([
    getAttendanceByService(date, viewer.services),
    getRecentServiceDates(viewer.services, ministry || undefined),
    getCheckInCountsByDate(`${month}-01`, new Date(lastOfMonth).toISOString().slice(0, 10), viewer.services, ministry || undefined),
  ]);

  const all = services.flatMap((s) => s.rows);
  // A member serving in several ministries counts once in each (always over the whole day, so
  // every chip shows its own count even while another ministry is selected)
  const ministryCounts = MINISTRY_OPTIONS.map((m) => ({
    ministry: m,
    count: new Set(all.filter((r) => r.ministries.includes(m)).map((r) => r.memberId)).size,
  }));
  const allMembers = new Set(all.map((r) => r.memberId)).size;

  const sign = dir === "asc" ? 1 : -1;
  const shown = services.map(({ service, rows }) => ({
    service,
    rows: rows.filter((r) => !ministry || r.ministries.includes(ministry)).sort((a, b) => sign * COMPARE[sort](a, b)),
  }));
  const shownAll = shown.flatMap((s) => s.rows);
  const uniqueMembers = new Set(shownAll.map((r) => r.memberId)).size;
  const filterNote = ministry ? `${ministryLabel(ministry)} only` : undefined;

  const chipCls = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm transition ${
      active ? "border-stm-navy bg-stm-navy text-white" : "border-gray-200 bg-white hover:border-stm-navy/40"
    }`;

  return (
    <div className="flex flex-col gap-6">
      {/* Phones: title, calendar, stats. Wider: calendar on the right of both. */}
      <div className="grid gap-6 sm:grid-cols-[1fr_auto] content-start">
        <div className="sm:col-start-1">
          <h1 className="text-2xl font-bold text-stm-navy">Attendance{viewer.serviceGroup && ` · ${viewer.serviceGroup}`}</h1>
          <p className="text-sm text-gray-500">{formatDateString(date)}</p>
        </div>

        <div className="sm:col-start-2 sm:row-start-1 sm:row-span-2">
          <AttendanceCalendar month={month} selected={date} today={today} counts={calendarCounts} keep={keep} />
        </div>

        <div className="sm:col-start-1 flex flex-col gap-6 min-w-0">
          {recentDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-500">Recent:</span>
              {recentDates.map((d) => (
                <Link
                  key={d.date}
                  href={href({ date: d.date })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    d.date === date ? "bg-stm-navy text-white" : "bg-gray-100 text-gray-600 hover:text-stm-navy"
                  }`}
                >
                  {d.date} · {d.total}
                </Link>
              ))}
            </div>
          )}

          <div className="grid gap-4 grid-cols-2">
            <StatCard label="Check-ins" value={shownAll.length} hint={filterNote} />
            <StatCard label="Members served" value={uniqueMembers} hint={filterNote ?? "Counted once across services"} />
          </div>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Filter by ministry</h2>
            <div className="flex flex-wrap gap-2">
              <Link href={href({ ministry: "" })} replace scroll={false} className={chipCls(!ministry)} aria-current={!ministry || undefined}>
                All <span className={`font-bold ${ministry ? "text-stm-navy" : ""}`}>{allMembers}</span>
              </Link>
              {ministryCounts.map(({ ministry: m, count }) => {
                const active = m === ministry;
                return (
                  <Link
                    key={m}
                    // Clicking the selected ministry again clears the filter
                    href={href({ ministry: active ? "" : m })}
                    replace
                    scroll={false}
                    aria-current={active || undefined}
                    className={chipCls(active)}
                  >
                    <span className={active ? "" : "text-gray-600"}>
                      <MinistryName ministry={m} />
                    </span>{" "}
                    <span className={`font-bold ${active ? "" : "text-stm-navy"}`}>{count}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Sort:</span>
        {SORT_KEYS.map((key) => {
          const active = key === sort;
          return (
            <Link
              key={key}
              // Clicking the active sort flips its direction
              href={href({ sort: key, dir: active && dir === "asc" ? "desc" : "asc" })}
              replace
              scroll={false}
              aria-current={active || undefined}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                active ? "bg-stm-navy text-white" : "bg-gray-100 text-gray-600 hover:text-stm-navy"
              }`}
            >
              {SORTS[key]}
              {active && <span aria-label={dir === "asc" ? " ascending" : " descending"}>{dir === "asc" ? " ▲" : " ▼"}</span>}
            </Link>
          );
        })}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {shown.map(({ service, rows }) => (
          <div key={service} className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{service}</h3>
              <span className="text-sm font-bold text-stm-green">{rows.length}</span>
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">
                {ministry ? `No ${ministryLabel(ministry)} check-ins.` : "No check-ins."}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <li key={r.memberId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-gray-900 truncate">
                        {sort === "first"
                          ? `${r.firstName}${r.nickname ? ` (${r.nickname})` : ""} ${r.lastName}`
                          : memberDisplayName(r)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{ministryList(r.ministries)}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">{formatTime(r.checkedInAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
