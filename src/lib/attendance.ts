import { and, arrayContains, asc, count, desc, eq, gte, inArray, isNotNull, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, eventCheckIns, events, leaders, members, staff } from "@/db/schema";
import type { PersonKind } from "@/lib/event-people-shared";

// Service queries take `services` — the signed-in user's services (Viewer.services) — so
// service-group users only count and see their own services' check-ins. Event check-ins
// aren't limited by service group: every staff user sees an event's full attendance.

/**
 * The page's filter: a MINISTRY_OPTIONS value (STMs in that ministry), or one of these for
 * the people only events have — leaders without a serve team and pastors & staff.
 */
export const KIND_FILTERS = { leaders: "Leaders", staff: "Pastors & Staff" } as const;
export type KindFilter = keyof typeof KIND_FILTERS;
export const isKindFilter = (f: string | undefined): f is KindFilter => f === "leaders" || f === "staff";

export interface AttendanceRow {
  /** `${kind}-${id}` — unique across STMs, leaders and staff */
  key: string;
  kind: PersonKind;
  lastName: string;
  firstName: string;
  middleInitial: string;
  nickname: string | null;
  /** STM: ministries; leader: ["Leader"] / ["ENC"]; staff: [their ministry] */
  ministries: string[];
  checkedInAt: Date;
  /** Event check-ins on pre-registration events only */
  isWalkIn: boolean;
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
  for (const { service, memberId, ...row } of rows) {
    byService.get(service)?.push({ ...row, key: `stm-${memberId}`, kind: "stm", isWalkIn: false });
  }
  return Array.from(byService, ([service, serviceRows]) => ({ service, rows: serviceRows }));
}

/** Service check-ins of members in `ministry` (when given); none at all for a leaders/staff filter. */
function ministryScope(filter: string | undefined): SQL | undefined {
  if (isKindFilter(filter)) return eq(members.id, -1);
  return filter ? arrayContains(members.ministries, [filter]) : undefined;
}

/** Event check-ins matching the filter. Needs `members` left-joined. */
function eventPersonScope(filter: string | undefined): SQL | undefined {
  if (filter === "leaders") return isNotNull(eventCheckIns.leaderId);
  if (filter === "staff") return isNotNull(eventCheckIns.staffId);
  return filter ? arrayContains(members.ministries, [filter]) : undefined;
}

/** Most recent dates with any service or event check-ins (of `ministry`, when given), newest first. */
export async function getRecentServiceDates(
  services: readonly string[],
  ministry?: string,
  limit = 8
): Promise<{ date: string; total: number }[]> {
  const [serviceRows, eventRows] = await Promise.all([
    db
      .select({ date: checkIns.serviceDate, total: count() })
      .from(checkIns)
      .innerJoin(members, eq(checkIns.memberId, members.id))
      .where(and(inArray(checkIns.service, [...services]), ministryScope(ministry)))
      .groupBy(checkIns.serviceDate)
      .orderBy(desc(checkIns.serviceDate))
      .limit(limit),
    db
      .select({ date: events.eventDate, total: count() })
      .from(eventCheckIns)
      .innerJoin(events, eq(eventCheckIns.eventId, events.id))
      .leftJoin(members, eq(eventCheckIns.memberId, members.id))
      .where(eventPersonScope(ministry))
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
  services: readonly string[],
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
          inArray(checkIns.service, [...services]),
          ministryScope(ministry)
        )
      )
      .groupBy(checkIns.serviceDate),
    db
      .select({ date: events.eventDate, total: count() })
      .from(eventCheckIns)
      .innerJoin(events, eq(eventCheckIns.eventId, events.id))
      .leftJoin(members, eq(eventCheckIns.memberId, members.id))
      .where(and(gte(events.eventDate, from), lte(events.eventDate, to), eventPersonScope(ministry)))
      .groupBy(events.eventDate),
  ]);
  return sumByDate([...serviceRows, ...eventRows]);
}

function sumByDate(rows: { date: string; total: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.date, (totals.get(r.date) ?? 0) + r.total);
  return totals;
}

/** Each event on `date` (even with no check-ins) and everyone — STMs, leaders, staff — who checked in to it. */
export async function getEventAttendance(
  date: string
): Promise<{ event: { id: number; name: string; preRegistration: boolean }; rows: AttendanceRow[] }[]> {
  const [dayEvents, rows] = await Promise.all([
    db
      .select({ id: events.id, name: events.name, preRegistration: events.preRegistration })
      .from(events)
      .where(eq(events.eventDate, date))
      .orderBy(asc(events.name)),
    db
      .select({
        eventId: eventCheckIns.eventId,
        checkedInAt: eventCheckIns.checkedInAt,
        isWalkIn: eventCheckIns.isWalkIn,
        member: {
          id: members.id,
          lastName: members.lastName,
          firstName: members.firstName,
          middleInitial: members.middleInitial,
          nickname: members.nickname,
          ministries: members.ministries,
        },
        leader: {
          id: leaders.id,
          lastName: leaders.lastName,
          firstName: leaders.firstName,
          nickname: leaders.nickname,
          isEnc: leaders.isEnc,
        },
        staff: { id: staff.id, lastName: staff.lastName, firstName: staff.firstName, nickname: staff.nickname, ministry: staff.ministry },
      })
      .from(eventCheckIns)
      .innerJoin(events, eq(eventCheckIns.eventId, events.id))
      .leftJoin(members, eq(eventCheckIns.memberId, members.id))
      .leftJoin(leaders, eq(eventCheckIns.leaderId, leaders.id))
      .leftJoin(staff, eq(eventCheckIns.staffId, staff.id))
      .where(eq(events.eventDate, date)),
  ]);

  const toRow = (r: (typeof rows)[number]): AttendanceRow & { eventId: number } => {
    const common = { eventId: r.eventId, checkedInAt: r.checkedInAt, isWalkIn: r.isWalkIn };
    if (r.member) return { ...common, ...r.member, key: `stm-${r.member.id}`, kind: "stm" };
    if (r.leader) {
      const { isEnc, ...l } = r.leader;
      return { ...common, ...l, middleInitial: "", ministries: [isEnc ? "ENC" : "Leader"], key: `leader-${l.id}`, kind: "leader" };
    }
    const { ministry, ...s } = r.staff!;
    return { ...common, ...s, middleInitial: "", ministries: [ministry], key: `staff-${s.id}`, kind: "staff" };
  };
  const all = rows.map(toRow);
  return dayEvents.map((event) => ({
    event,
    rows: all.filter((r) => r.eventId === event.id).map(({ eventId: _eventId, ...row }) => row),
  }));
}
