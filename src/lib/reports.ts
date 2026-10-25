import { and, countDistinct, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, members } from "@/db/schema";
import { memberScope, type Viewer } from "@/lib/access";
import { activeMemberCondition } from "@/lib/activity";
import type { ActivityRule } from "@/lib/activity-rule";
import { DISCIPLESHIP_JOURNEY_STEPS, GENDER_OPTIONS, LIFESTAGE_OPTIONS, MINISTRY_OPTIONS } from "@/lib/constants";

export const NOT_SET = "Not set";

export const AGE_GROUPS = [
  { label: "Under 18", min: 0, max: 17 },
  { label: "18–24", min: 18, max: 24 },
  { label: "25–34", min: 25, max: 34 },
  { label: "35–44", min: 35, max: 44 },
  { label: "45–54", min: 45, max: 54 },
  { label: "55+", min: 55, max: Infinity },
] as const;

export interface Count {
  label: string;
  value: number;
}

export interface Demographics {
  total: number;
  averageAge: number | null;
  withVgl: number;
  /** Members who completed every discipleship journey step. */
  journeyComplete: number;
  gender: Count[];
  ageGroups: Count[];
  lifestage: Count[];
  /** A member in several ministries counts once in each. */
  ministries: Count[];
  /** Members who completed each step, in journey order. */
  journey: Count[];
  vgl: Count[];
  services: Count[];
}

/** Counts each fixed option in order, then any other stored value, then "Not set" (only if any). */
function tally(values: (string | null)[], options: readonly string[]): Count[] {
  const counts = new Map<string, number>(options.map((o) => [o, 0]));
  let unset = 0;
  for (const v of values) {
    if (!v) unset++;
    else counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const rows = [...counts].map(([label, value]) => ({ label, value }));
  return unset ? [...rows, { label: NOT_SET, value: unset }] : rows;
}

/**
 * Demographics of active members within the viewer's services, narrowed to `services`
 * (e.g. one service group's) when given. A few hundred rows, so it's counted in JS rather
 * than one GROUP BY per breakdown.
 */
export async function getDemographics(
  viewer: Viewer,
  services: readonly string[] | null,
  rule: ActivityRule
): Promise<Demographics> {
  const rows = await db
    .select({
      gender: members.gender,
      age: members.age,
      lifestage: members.lifestage,
      ministries: members.ministries,
      journey: members.discipleshipJourneyCompleted,
      vglId: members.vglId,
      vglName: members.vglName,
      serviceAttending: members.serviceAttending,
    })
    .from(members)
    .where(
      and(activeMemberCondition(rule), memberScope(viewer), services ? inArray(members.serviceAttending, [...services]) : undefined)
    );

  const ages = rows.map((r) => r.age).filter((a): a is number => a !== null);
  const steps = rows.map((r) => new Set((r.journey ?? "").split(",").filter(Boolean)));

  const ageGroups = AGE_GROUPS.map((g) => ({ label: g.label, value: ages.filter((a) => a >= g.min && a <= g.max).length }));
  const agesUnset = rows.length - ages.length;

  return {
    total: rows.length,
    averageAge: ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null,
    withVgl: rows.filter((r) => r.vglName).length,
    journeyComplete: steps.filter((s) => DISCIPLESHIP_JOURNEY_STEPS.every((step) => s.has(step))).length,
    gender: tally(
      rows.map((r) => r.gender),
      GENDER_OPTIONS
    ),
    ageGroups: agesUnset ? [...ageGroups, { label: NOT_SET, value: agesUnset }] : ageGroups,
    lifestage: tally(
      rows.map((r) => r.lifestage),
      LIFESTAGE_OPTIONS
    ),
    ministries: MINISTRY_OPTIONS.map((m) => ({ label: m, value: rows.filter((r) => r.ministries.includes(m)).length })),
    journey: DISCIPLESHIP_JOURNEY_STEPS.map((step) => ({ label: step, value: steps.filter((s) => s.has(step)).length })),
    vgl: [
      { label: "Linked to VGL list", value: rows.filter((r) => r.vglId !== null).length },
      { label: "Typed in (not in list)", value: rows.filter((r) => r.vglId === null && r.vglName).length },
      { label: NOT_SET, value: rows.filter((r) => !r.vglName).length },
    ],
    services: tally(
      rows.map((r) => r.serviceAttending),
      services ?? viewer.services
    ),
  };
}

export const NO_MINISTRY = "No ministry";

export interface MinistryServiceTable {
  services: readonly string[];
  /** One row per ministry (plus "No ministry" if anyone has none); counts per service. */
  rows: { ministry: string; counts: number[]; total: number }[];
  /** Distinct STMs per service — not the column sum, since one person can be in several ministries. */
  serviceTotals: number[];
  /** Distinct STMs across every service that day. */
  total: number;
}

/**
 * STMs checked in on `date`, per ministry × service. A member in several ministries counts
 * in each ministry row; row and column totals count distinct people, so someone who served
 * both 2PM and 4PM is one person in the row total.
 */
export async function getMinistryServiceTable(date: string, services: readonly string[]): Promise<MinistryServiceTable> {
  const rows = await db
    .select({ memberId: checkIns.memberId, service: checkIns.service, ministries: members.ministries })
    .from(checkIns)
    .innerJoin(members, eq(checkIns.memberId, members.id))
    .where(and(eq(checkIns.serviceDate, date), inArray(checkIns.service, [...services])));

  const ministryNames = [...MINISTRY_OPTIONS, ...(rows.some((r) => r.ministries.length === 0) ? [NO_MINISTRY] : [])];
  // ministry → service → member ids
  const cells = new Map(ministryNames.map((m) => [m, new Map(services.map((s) => [s, new Set<number>()]))]));
  const byService = new Map(services.map((s) => [s, new Set<number>()]));
  for (const r of rows) {
    byService.get(r.service)?.add(r.memberId);
    for (const m of r.ministries.length ? r.ministries : [NO_MINISTRY]) cells.get(m)?.get(r.service)?.add(r.memberId);
  }

  return {
    services,
    rows: ministryNames.map((ministry) => {
      const perService = services.map((s) => cells.get(ministry)!.get(s)!);
      return {
        ministry,
        counts: perService.map((set) => set.size),
        total: new Set(perService.flatMap((set) => [...set])).size,
      };
    }),
    serviceTotals: services.map((s) => byService.get(s)!.size),
    total: new Set(rows.map((r) => r.memberId)).size,
  };
}

/** Dates with any check-ins to `services` (newest first) and how many STMs served — for the date picker. */
export async function getServiceDates(services: readonly string[]): Promise<{ date: string; total: number }[]> {
  return db
    .select({ date: checkIns.serviceDate, total: countDistinct(checkIns.memberId) })
    .from(checkIns)
    .where(inArray(checkIns.service, [...services]))
    .groupBy(checkIns.serviceDate)
    .orderBy(desc(checkIns.serviceDate));
}
