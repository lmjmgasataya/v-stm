import Link from "next/link";
import { and, count, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { memberScope, requireViewer } from "@/lib/access";
import { activeMemberCondition } from "@/lib/activity";
import { getActivityRule } from "@/lib/settings";
import { getAttendanceByService } from "@/lib/attendance";
import { getEventsOn } from "@/lib/events";
import { formatDateString, manilaDateString } from "@/lib/date";
import { MinistryName } from "@/components/MinistryName";
import { StatCard } from "@/components/StatCard";
import { primaryBtnCls, secondaryBtnCls } from "@/components/form";

export default async function DashboardPage() {
  const viewer = await requireViewer();
  // "Active" follows the activity rule when it's on (Settings), else everyone on the roster
  const activeInScope = and(activeMemberCondition(await getActivityRule()), memberScope(viewer));

  const today = manilaDateString();
  const [[{ active }], byMinistry, todayByService] = await Promise.all([
    db.select({ active: count() }).from(members).where(activeInScope),
    db
      .select({ ministry: sql<string>`unnest(${members.ministries})`.as("ministry"), total: count() })
      .from(members)
      .where(activeInScope)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    getAttendanceByService(today, viewer.services),
  ]);
  const todaysEvents = await getEventsOn(today);
  const checkedInToday = todayByService.reduce((sum, s) => sum + s.rows.length, 0);
  // Services are on Sundays: other days hide the per-service section — unless someone was
  // checked in to a service anyway (a special schedule), so those check-ins still show
  const isSunday = new Date(`${today}T00:00:00Z`).getUTCDay() === 0;
  const showServices = isSunday || checkedInToday > 0;
  const eventCheckInsToday = todaysEvents.reduce((sum, e) => sum + e.checkedIn, 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Service Team{viewer.serviceGroup && ` · ${viewer.serviceGroup}`}</h1>
          <p className="text-sm text-stone-500">{formatDateString(today)}</p>
        </div>
        <div className="flex gap-2">
          {viewer.canManageMembers && (
            <Link href="/members/new" className={secondaryBtnCls}>
              + Add STM
            </Link>
          )}
          <Link href="/check-in" className={primaryBtnCls}>
            Open Sunday check-in
          </Link>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Active members" value={active} />
        {showServices && <StatCard label="Checked in today" value={checkedInToday} hint="Sunday services" />}
        {todaysEvents.length > 0 && <StatCard label="Event check-ins today" value={eventCheckInsToday} />}
      </div>

      {todaysEvents.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">Today&apos;s events</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {todaysEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group flex flex-col gap-3 rounded-2xl border-2 border-stm-brand/20 bg-white p-4 shadow-sm hover:border-stm-brand/50 transition"
              >
                <p className="font-semibold text-stone-900 group-hover:text-stm-brand">★ {event.name}</p>
                <div className="flex flex-wrap items-end gap-x-5 gap-y-1 text-sm">
                  <p>
                    <span className="text-2xl font-bold text-stm-green">{event.checkedIn}</span>
                    <span className="text-stone-500">
                      {event.preRegistration ? ` checked in · ${event.willAttend} pre-registered` : " checked in"}
                    </span>
                  </p>
                  {event.walkIns > 0 && <p className="font-semibold text-stm-amber">{event.walkIns} walk-ins</p>}
                </div>
                <span className="self-start rounded-full bg-stm-green px-4 py-1.5 text-sm font-semibold text-white group-hover:bg-stm-green/90">
                  Check in →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {showServices && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">Today by service</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
            {todayByService.map(({ service, rows }) => (
              <Link
                key={service}
                href={`/check-in?service=${encodeURIComponent(service)}`}
                className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-3 hover:border-stm-brand/40 hover:shadow-sm transition"
              >
                <p className="text-xs text-stone-500">{service}</p>
                <p className="text-xl font-bold text-stm-green">{rows.length}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">Active members by ministry</h2>
        {byMinistry.length === 0 ? (
          <p className="text-sm text-stone-400">No members yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {byMinistry.map(({ ministry, total }) => (
              <Link
                key={ministry}
                href={`/members?ministry=${encodeURIComponent(ministry)}`}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:border-stm-brand/40 transition"
              >
                <span className="text-stone-600">
                  <MinistryName ministry={ministry} />
                </span>{" "}
                <span className="font-bold text-stm-brand">{total}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
