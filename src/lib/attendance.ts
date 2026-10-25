import { and, arrayContains, asc, count, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, eventCheckIns, events, members } from "@/db/schema";

// Every query takes `services` — the signed-in user's services (Viewer.services) — so
// service-group users only ever count and see their own services' check-ins.

export interface AttendanceRow {
  memberId: number;
  lastName: string;
  firstName: string;
  middleInitial: string;
  nickname: string | null;
  ministries: string[];
  checkedInAt: Date;
}

/** One day's check-ins grouped by service, in `services` order (every service listed, even empty). */
export async function getAttendanceByService(
  serviceDate: string,
  services: readonly string[]
): Promise<{ service: string; rows: AttendanceRow[] }[]> {
  const rows = await db
    .select({
      service: checkIns.service,
      memberId: members.id,
      lastName: members.lastName,
      firstName: members.firstName,
      middleInitial: members.middleInitial,
      nickname: members.nickname,
      ministries: members.ministries,
      checkedInAt: checkIns.checkedInAt,
    })
    .from(checkIns)
    .innerJoin(members, eq(checkIns.memberId, members.id))
    .where(and(eq(checkIns.serviceDate, serviceDate), inArray(checkIns.service, [...services])))
    .orderBy(asc(members.lastName), asc(members.firstName));

  const byService = new Map<string, AttendanceRow[]>(services.map((s) => [s, []]));
  for (const { service, ...row } of rows) {
    byService.get(service)?.push(row);
  }
  return Array.from(byService, ([service, serviceRows]) => ({ service, rows: serviceRows }));
}

/** Only check-ins of members in `ministry` (when given). */
function ministryScope(ministry: string | undefined) {
  return ministry ? arrayContains(members.ministries, [ministry]) : undefined;
}

/**
 * What a viewer may count: service check-ins limited to their services, event check-ins
 * limited to their members (memberScope). Built by the attendance page from the Viewer.
 */
export interface AttendanceScope {
  services: readonly string[];
  members: SQL | undefined;
}

/** Most recent dates with any service or event check-ins (of `ministry`, when given), newest first. */
export async function getRecentServiceDates(
  scope: AttendanceScope,
  ministry?: string,
  limit = 8
): Promise<{ date: string; total: number }[]> {
  const [serviceRows, eventRows] = await Promise.all([
    db
      .select({ date: checkIns.serviceDate, total: count() })
      .from(checkIns)
      .innerJoin(members, eq(checkIns.memberId, members.id))
      .where(and(inArray(checkIns.service, [...scope.services]), ministryScope(ministry)))
      .groupBy(checkIns.serviceDate)
      .orderBy(desc(checkIns.serviceDate))
      .limit(limit),
    db
      .select({ date: events.eventDate, total: count() })
      .from(eventCheckIns)
      .innerJoin(events, eq(eventCheckIns.eventId, events.id))
      .innerJoin(members, eq(eventCheckIns.memberId, members.id))
      .where(and(scope.members, ministryScope(ministry)))
      .groupBy(events.eventDate)
      .orderBy(desc(events.eventDate))
      .limit(limit),
  ]);
  return [...sumByDate([...serviceRows, ...eventRows])]
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/**
 * Service and event check-ins (of `ministry`, when given) per date ("YYYY-MM-DD" → count)
 * between two dates, inclusive — for the calendar.
 */
export async function getCheckInCountsByDate(
  from: string,
  to: string,
  scope: AttendanceScope,
  ministry?: string
): Promise<Map<string, number>> {
  const [serviceRows, eventRows] = await Promise.all([
    db
      .select({ date: checkIns.serviceDate, total: count() })
      .from(checkIns)
      .innerJoin(members, eq(checkIns.memberId, members.id))
      .where(
        and(
          gte(checkIns.serviceDate, from),
          lte(checkIns.serviceDate, to),
          inArray(checkIns.service, [...scope.services]),
          ministryScope(ministry)
        )
      )
      .groupBy(checkIns.serviceDate),
    db
      .select({ date: events.eventDate, total: count() })
      .from(eventCheckIns)
      .innerJoin(events, eq(eventCheckIns.eventId, events.id))
      .innerJoin(members, eq(eventCheckIns.memberId, members.id))
      .where(and(gte(events.eventDate, from), lte(events.eventDate, to), scope.members, ministryScope(ministry)))
      .groupBy(events.eventDate),
  ]);
  return sumByDate([...serviceRows, ...eventRows]);
}

function sumByDate(rows: { date: string; total: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.date, (totals.get(r.date) ?? 0) + r.total);
  return totals;
}

/** Each event on `date` (even with no check-ins) and who checked in to it, within the scope. */
export async function getEventAttendance(
  date: string,
  scope: AttendanceScope
): Promise<{ event: { id: number; name: string }; rows: AttendanceRow[] }[]> {
  const [dayEvents, rows] = await Promise.all([
    db.select({ id: events.id, name: events.name }).from(events).where(eq(events.eventDate, date)).orderBy(asc(events.name)),
    db
      .select({
        eventId: eventCheckIns.eventId,
        memberId: members.id,
        lastName: members.lastName,
        firstName: members.firstName,
        middleInitial: members.middleInitial,
        nickname: members.nickname,
        ministries: members.ministries,
        checkedInAt: eventCheckIns.checkedInAt,
      })
      .from(eventCheckIns)
      .innerJoin(events, eq(eventCheckIns.eventId, events.id))
      .innerJoin(members, eq(eventCheckIns.memberId, members.id))
      .where(and(eq(events.eventDate, date), scope.members)),
  ]);
  return dayEvents.map((event) => ({
    event,
    rows: rows.filter((r) => r.eventId === event.id).map(({ eventId: _eventId, ...row }) => row),
  }));
}
