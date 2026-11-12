import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, members } from "@/db/schema";
import { memberScope, type Viewer } from "@/lib/access";
import { activeMemberCondition } from "@/lib/activity";
import type { ActivityRule } from "@/lib/activity-rule";
import {
  MINISTRY_OPTIONS,
  SERVICE_ATTENDING_BY_GROUP,
  SERVICE_GROUPS,
  SERVICE_GROUP_NAMES,
  isServiceGroup,
  type ServiceGroup,
} from "@/lib/constants";
import { manilaDateString } from "@/lib/date";
import { NO_MINISTRY, getServiceDates } from "@/lib/reports";

// Insights tabs (Demographics, Engagement, Ministry health). Like every report they stay within the
// viewer's services, and a super admin can narrow them to one service group (`?group=`).

/** Service dates the Engagement and Ministry health tabs look back over. */
export const LOOKBACK = 8;
/** Missing this many of the latest service dates in a row puts a member on the follow-up list. */
export const FOLLOW_UP_AFTER = 3;
/** "Served recently" = on any of this many latest service dates. */
export const RECENT = 4;

export interface InsightsScope {
  /** Group filter chips: every group for users with no group of their own, none otherwise. */
  groups: ServiceGroup[];
  group: ServiceGroup | null;
  /** Members' service-attending values in view. */
  attending: readonly string[];
  /** Check-in services in view. */
  services: readonly string[];
  /** "All services", the picked group, or the viewer's own group. */
  name: string;
}

export function insightsScope(viewer: Viewer, groupParam: string | undefined): InsightsScope {
  // A group user only has their own group, so they get no filter
  const groups = viewer.serviceGroup ? [] : SERVICE_GROUP_NAMES;
  const group = isServiceGroup(groupParam) && groups.includes(groupParam) ? groupParam : null;
  return {
    groups,
    group,
    attending: group ? [SERVICE_ATTENDING_BY_GROUP[group]] : viewer.attending,
    services: group ? SERVICE_GROUPS[group] : viewer.services,
    name: group ?? viewer.serviceGroup ?? "All services",
  };
}

/** Members on the roster (isActive) within the scope. The activity rule isn't applied: lapsing is the point here. */
function rosterWhere(viewer: Viewer, scope: InsightsScope) {
  return and(eq(members.isActive, true), memberScope(viewer), scope.group ? inArray(members.serviceAttending, [...scope.attending]) : undefined);
}

/** The latest LOOKBACK dates with check-ins to the scope's services, newest first (today included). */
async function lookbackDates(scope: InsightsScope): Promise<string[]> {
  const today = manilaDateString();
  return (await getServiceDates(scope.services))
    .map((d) => d.date)
    .filter((d) => d <= today)
    .slice(0, LOOKBACK);
}

/** Which of `dates` each member served on (any service in scope), by member id. */
async function servedOn(memberIds: number[], dates: string[], services: readonly string[]): Promise<Map<number, Set<string>>> {
  const served = new Map<number, Set<string>>();
  if (!memberIds.length || !dates.length) return served;
  const rows = await db
    .selectDistinct({ memberId: checkIns.memberId, date: checkIns.serviceDate })
    .from(checkIns)
    .where(and(inArray(checkIns.memberId, memberIds), inArray(checkIns.serviceDate, dates), inArray(checkIns.service, [...services])));
  for (const r of rows) {
    if (!served.has(r.memberId)) served.set(r.memberId, new Set());
    served.get(r.memberId)!.add(r.date);
  }
  return served;
}

// ---- Engagement

export interface EngagementMember {
  id: number;
  lastName: string;
  firstName: string;
  middleInitial: string;
  nickname: string | null;
  mobileNumber: string;
  facebookMessengerName: string | null;
  serviceAttending: string | null;
  ministry: string;
  /** Latest service date they checked in to (in scope), any time; null = never. */
  lastServed: string | null;
  /** Lookback dates they served on. */
  served: number;
}

export interface Engagement {
  /** Lookback dates, newest first. */
  dates: string[];
  roster: number;
  /** Served on any of the latest RECENT dates. */
  servedRecently: number;
  /** How many members served on how many of the lookback dates, most often first. */
  frequency: { label: string; min: number; max: number; value: number }[];
  /** Served before, but on none of the latest FOLLOW_UP_AFTER dates — most recently seen first. */
  followUp: EngagementMember[];
  /** On the roster but never checked in (in scope) — newest additions first. */
  neverServed: EngagementMember[];
}

export async function getEngagement(viewer: Viewer, scope: InsightsScope): Promise<Engagement> {
  const [roster, dates] = await Promise.all([
    db
      .select({
        id: members.id,
        lastName: members.lastName,
        firstName: members.firstName,
        middleInitial: members.middleInitial,
        nickname: members.nickname,
        mobileNumber: members.mobileNumber,
        facebookMessengerName: members.facebookMessengerName,
        serviceAttending: members.serviceAttending,
        ministries: members.ministries,
        createdAt: members.createdAt,
      })
      .from(members)
      .where(rosterWhere(viewer, scope)),
    lookbackDates(scope),
  ]);
  const ids = roster.map((m) => m.id);
  const [served, lastRows] = await Promise.all([
    servedOn(ids, dates, scope.services),
    ids.length
      ? db
          // ::text, or node-postgres could hand back a JS Date at local midnight
          .select({ memberId: checkIns.memberId, last: sql<string>`max(${checkIns.serviceDate})::text` })
          .from(checkIns)
          .where(and(inArray(checkIns.memberId, ids), inArray(checkIns.service, [...scope.services])))
          .groupBy(checkIns.memberId)
      : [],
  ]);
  const lastServed = new Map(lastRows.map((r) => [r.memberId, r.last]));

  const rows: (EngagementMember & { createdAt: Date })[] = roster.map(({ ministries, ...m }) => ({
    ...m,
    ministry: ministries[0] ?? NO_MINISTRY,
    lastServed: lastServed.get(m.id) ?? null,
    served: served.get(m.id)?.size ?? 0,
  }));

  const recent = new Set(dates.slice(0, RECENT));
  const followUpDates = new Set(dates.slice(0, FOLLOW_UP_AFTER));
  const servedAny = (id: number, within: Set<string>) => [...(served.get(id) ?? [])].some((d) => within.has(d));
  const byName = (a: EngagementMember, b: EngagementMember) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
  const strip = ({ createdAt: _, ...m }: EngagementMember & { createdAt: Date }): EngagementMember => m;

  return {
    dates,
    roster: rows.length,
    servedRecently: rows.filter((m) => servedAny(m.id, recent)).length,
    frequency: frequencyBuckets(dates.length).map((b) => ({ ...b, value: rows.filter((m) => m.served >= b.min && m.served <= b.max).length })),
    followUp: rows
      .filter((m) => m.lastServed && !servedAny(m.id, followUpDates))
      .sort((a, b) => b.lastServed!.localeCompare(a.lastServed!) || byName(a, b))
      .map(strip),
    neverServed: rows
      .filter((m) => !m.lastServed)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || byName(a, b))
      .map(strip),
  };
}

/** Over n dates: most (≥ ¾), some (≥ ⅜), once or twice, none — skipping empty ranges when n is small. */
function frequencyBuckets(n: number): { label: string; min: number; max: number }[] {
  const most = Math.max(1, Math.ceil(n * 0.75));
  const some = Math.max(1, Math.ceil(n * 0.375));
  const range = (lo: number, hi: number) => (lo === hi ? `${lo}` : `${lo}–${hi}`);
  const buckets = [
    { label: `${range(most, n)} of ${n}`, min: most, max: n },
    { label: `${range(some, most - 1)} of ${n}`, min: some, max: most - 1 },
    { label: `${range(1, some - 1)} of ${n}`, min: 1, max: some - 1 },
    { label: "None", min: 0, max: 0 },
  ];
  return n === 0 ? [buckets[3]] : buckets.filter((b) => b.min <= b.max);
}

// ---- Ministry health

export interface MinistryHealthRow {
  ministry: string;
  roster: number;
  /** Active per the activity rule (equals roster while the rule is off). */
  active: number;
  /** Average STMs serving per lookback date. */
  average: number;
  /** STMs who served on the latest lookback date. */
  latest: number;
  /** Rostered members who served on any of the latest RECENT dates. */
  servedRecently: number;
}

export interface MinistryHealth {
  dates: string[];
  rows: MinistryHealthRow[];
  total: MinistryHealthRow;
}

export async function getMinistryHealth(viewer: Viewer, scope: InsightsScope, rule: ActivityRule): Promise<MinistryHealth> {
  const where = rosterWhere(viewer, scope);
  const [roster, activeRows, dates] = await Promise.all([
    db.select({ id: members.id, ministries: members.ministries }).from(members).where(where),
    db.select({ id: members.id }).from(members).where(and(where, activeMemberCondition(rule))),
    lookbackDates(scope),
  ]);
  const active = new Set(activeRows.map((r) => r.id));
  const served = await servedOn(
    roster.map((m) => m.id),
    dates,
    scope.services
  );
  const recent = new Set(dates.slice(0, RECENT));

  const summarize = (ministry: string, group: { id: number }[]): MinistryHealthRow => {
    const sets = group.map((m) => served.get(m.id) ?? new Set<string>());
    const serves = sets.reduce((sum, s) => sum + s.size, 0);
    return {
      ministry,
      roster: group.length,
      active: group.filter((m) => active.has(m.id)).length,
      average: dates.length ? Math.round((serves / dates.length) * 10) / 10 : 0,
      latest: dates.length ? sets.filter((s) => s.has(dates[0])).length : 0,
      servedRecently: sets.filter((s) => [...s].some((d) => recent.has(d))).length,
    };
  };

  const noMinistry = roster.filter((m) => !m.ministries.length);
  const rows = MINISTRY_OPTIONS.map((ministry) =>
    summarize(
      ministry,
      roster.filter((m) => m.ministries.includes(ministry))
    )
  ).filter((r) => r.roster > 0);
  if (noMinistry.length) rows.push(summarize(NO_MINISTRY, noMinistry));
  return { dates, rows, total: summarize("All ministries", roster) };
}
