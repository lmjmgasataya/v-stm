import { and, arrayContains, asc, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, members } from "@/db/schema";

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

/** Most recent dates that have any check-ins (of `ministry`, when given), newest first. */
export async function getRecentServiceDates(
  services: readonly string[],
  ministry?: string,
  limit = 8
): Promise<{ date: string; total: number }[]> {
  return db
    .select({ date: checkIns.serviceDate, total: count() })
    .from(checkIns)
    .innerJoin(members, eq(checkIns.memberId, members.id))
    .where(and(inArray(checkIns.service, [...services]), ministryScope(ministry)))
    .groupBy(checkIns.serviceDate)
    .orderBy(desc(checkIns.serviceDate))
    .limit(limit);
}

/** Check-ins (of `ministry`, when given) per date ("YYYY-MM-DD" → count) between two dates, inclusive — for the calendar. */
export async function getCheckInCountsByDate(
  from: string,
  to: string,
  services: readonly string[],
  ministry?: string
): Promise<Map<string, number>> {
  const rows = await db
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
    .groupBy(checkIns.serviceDate);
  return new Map(rows.map((r) => [r.date, r.total]));
}
