import Link from "next/link";
import { memberScope, requireViewer } from "@/lib/access";
import {
  getAttendanceByService,
  getCheckInCountsByDate,
  getEventAttendance,
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

  const scope = { services: viewer.services, members: memberScope(viewer) };
  const [services, dayEvents, recentDates, calendarCounts] = await Promise.all([
    getAttendanceByService(date, viewer.services),
    getEventAttendance(date, scope),
    getRecentServiceDates(scope, ministry || undefined),
    getCheckInCountsByDate(`${month}-01`, new Date(lastOfMonth).toISOString().slice(0, 10), scope, ministry || undefined),
  ]);

  // Totals and ministry counts cover the day's services and events together
  const all = [...services, ...dayEvents].flatMap((s) => s.rows);
  // A member serving in several ministries counts once in each (always over the whole day, so
  // every chip shows its own count even while another ministry is selected)
  const ministryCounts = MINISTRY_OPTIONS.map((m) => ({
    ministry: m,
    count: new Set(all.filter((r) => r.ministries.includes(m)).map((r) => r.memberId)).size,
  }));
  const allMembers = new Set(all.map((r) => r.memberId)).size;

  const sign = dir === "asc" ? 1 : -1;
  const prepare = (rows: AttendanceRow[]) =>
    rows.filter((r) => !ministry || r.ministries.includes(ministry)).sort((a, b) => sign * COMPARE[sort](a, b));
  const serviceCards = services.map(({ service, rows }) => ({ key: service, title: service, href: undefined, rows: prepare(rows) }));
  const eventCards = dayEvents.map(({ event, rows }) => ({
    key: `event-${event.id}`,
    title: `★ ${event.name}`,
    href: `/events/${event.id}`,
    rows: prepare(rows),
  }));
  const shownAll = [...serviceCards, ...eventCards].flatMap((s) => s.rows);
  const uniqueMembers = new Set(shownAll.map((r) => r.memberId)).size;
  const filterNote = ministry ? `${ministryLabel(ministry)} only` : undefined;

  const chipCls = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm transition ${
      active ? "border-stm-brand bg-stm-brand text-white" : "border-stone-200 bg-white hover:border-stm-brand/40"
    }`;

  return (
    <div className="flex flex-col gap-6">
      {/* Phones: title, calendar, stats. Wider: calendar on the right of both. */}
      <div className="grid gap-6 sm:grid-cols-[1fr_auto] content-start">
        <div className="sm:col-start-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Attendance{viewer.serviceGroup && ` · ${viewer.serviceGroup}`}</h1>
          <p className="text-sm text-stone-500">{formatDateString(date)}</p>
        </div>

        <div className="sm:col-start-2 sm:row-start-1 sm:row-span-2">
          <AttendanceCalendar month={month} selected={date} today={today} counts={calendarCounts} keep={keep} />
        </div>

        <div className="sm:col-start-1 flex flex-col gap-6 min-w-0">
          {recentDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-stone-500">Recent:</span>
              {recentDates.map((d) => (
                <Link
                  key={d.date}
                  href={href({ date: d.date })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    d.date === date ? "bg-stm-brand text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stm-brand/40 hover:text-stm-brand"
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">Filter by ministry</h2>
            <div className="flex flex-wrap gap-2">
              <Link href={href({ ministry: "" })} replace scroll={false} className={chipCls(!ministry)} aria-current={!ministry || undefined}>
                All <span className={`font-bold ${ministry ? "text-stm-brand" : ""}`}>{allMembers}</span>
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
                    <span className={active ? "" : "text-stone-600"}>
                      <MinistryName ministry={m} />
                    </span>{" "}
                    <span className={`font-bold ${active ? "" : "text-stm-brand"}`}>{count}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-stone-500">Sort:</span>
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
                active ? "bg-stm-brand text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stm-brand/40 hover:text-stm-brand"
              }`}
            >
              {SORTS[key]}
              {active && <span aria-label={dir === "asc" ? " ascending" : " descending"}>{dir === "asc" ? " ▲" : " ▼"}</span>}
            </Link>
          );
        })}
      </div>

      {eventCards.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">Events</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {eventCards.map((card) => (
              <AttendanceCard key={card.key} title={card.title} href={card.href} rows={card.rows} ministry={ministry} sort={sort} />
            ))}
          </div>
        </section>
      )}

      <section>
        {eventCards.length > 0 && (
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">Services</h2>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {serviceCards.map((card) => (
            <AttendanceCard key={card.key} title={card.title} href={card.href} rows={card.rows} ministry={ministry} sort={sort} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AttendanceCard({
  title,
  href,
  rows,
  ministry,
  sort,
}: {
  title: string;
  href: string | undefined;
  rows: AttendanceRow[];
  ministry: string;
  sort: SortKey;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <h3 className="font-semibold text-stone-900">
          {href ? (
            <Link href={href} className="hover:text-stm-brand hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <span className="text-sm font-bold text-stm-green">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-stone-400">{ministry ? `No ${ministryLabel(ministry)} check-ins.` : "No check-ins."}</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map((r) => (
            <li key={r.memberId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <div className="min-w-0">
                <p className="text-stone-900 truncate">
                  {sort === "first" ? `${r.firstName}${r.nickname ? ` (${r.nickname})` : ""} ${r.lastName}` : memberDisplayName(r)}
                </p>
                <p className="text-xs text-stone-500 truncate">{ministryList(r.ministries)}</p>
              </div>
              <span className="shrink-0 text-xs text-stone-500">{formatTime(r.checkedInAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
