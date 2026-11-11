import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { eventCheckIns, eventRegistrations, leaders, members, staff } from "@/db/schema";
import { MINISTRY_OPTIONS, SERVICE_GROUP_NAMES, groupOfAttending, isServiceGroup, type ServiceGroup } from "@/lib/constants";
import type { EventPerson, EventPersonCheckIn, PersonKind } from "@/lib/event-people-shared";

// Everyone who can be checked in to an event: STMs (stm_members), leaders without a serve
// team (stm_leaders) and pastors & staff (stm_staff), each with their pre-registration.

const personKey = (kind: PersonKind, id: number) => `${kind}-${id}`;

/** Registration key → attending, for one event */
async function registrationsOf(eventId: number) {
  const rows = await db
    .select({
      memberId: eventRegistrations.memberId,
      leaderId: eventRegistrations.leaderId,
      staffId: eventRegistrations.staffId,
      attending: eventRegistrations.attending,
    })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventId, eventId));
  return new Map(rows.map((r) => [keyOfRow(r), r.attending]));
}

function keyOfRow(r: { memberId: number | null; leaderId: number | null; staffId: number | null }): string {
  if (r.memberId !== null) return personKey("stm", r.memberId);
  if (r.leaderId !== null) return personKey("leader", r.leaderId);
  return personKey("staff", r.staffId!);
}

export async function getEventPersonCheckIns(eventId: number): Promise<EventPersonCheckIn[]> {
  const rows = await db
    .select({
      memberId: eventCheckIns.memberId,
      leaderId: eventCheckIns.leaderId,
      staffId: eventCheckIns.staffId,
      isWalkIn: eventCheckIns.isWalkIn,
      checkedInAt: eventCheckIns.checkedInAt,
    })
    .from(eventCheckIns)
    .where(eq(eventCheckIns.eventId, eventId));
  return rows.map((r) => ({ key: keyOfRow(r), isWalkIn: r.isWalkIn, checkedInAt: r.checkedInAt.toISOString() }));
}

/**
 * Every active STM, leader and pastor/staff (plus anyone already checked in, even if since
 * made inactive), with their registration for this event. Not limited by service group.
 */
export async function getEventRoster(eventId: number, checkedInKeys: Set<string>): Promise<EventPerson[]> {
  const idsOf = (kind: PersonKind) =>
    [...checkedInKeys].filter((k) => k.startsWith(`${kind}-`)).map((k) => Number(k.slice(kind.length + 1)));
  const activeOr = <T extends typeof members | typeof leaders | typeof staff>(table: T, ids: number[]) =>
    ids.length ? or(eq(table.isActive, true), inArray(table.id, ids)) : eq(table.isActive, true);

  const [registered, stmRows, leaderRows, staffRows] = await Promise.all([
    registrationsOf(eventId),
    db
      .select({
        id: members.id,
        lastName: members.lastName,
        firstName: members.firstName,
        middleInitial: members.middleInitial,
        nickname: members.nickname,
        mobileNumber: members.mobileNumber,
        serviceAttending: members.serviceAttending,
        vglName: members.vglName,
        ministries: members.ministries,
      })
      .from(members)
      .where(activeOr(members, idsOf("stm")))
      .orderBy(asc(members.lastName), asc(members.firstName)),
    db.select().from(leaders).where(activeOr(leaders, idsOf("leader"))).orderBy(asc(leaders.lastName), asc(leaders.firstName)),
    db.select().from(staff).where(activeOr(staff, idsOf("staff"))).orderBy(asc(staff.lastName), asc(staff.firstName)),
  ]);

  const people: EventPerson[] = [
    ...stmRows.map((m) => ({
      key: personKey("stm", m.id),
      kind: "stm" as const,
      id: m.id,
      lastName: m.lastName,
      firstName: m.firstName,
      middleInitial: m.middleInitial,
      nickname: m.nickname,
      mobileNumber: m.mobileNumber,
      vglName: m.vglName,
      ministries: m.ministries,
      detail: m.serviceAttending,
      registered: registered.get(personKey("stm", m.id)) ?? null,
    })),
    ...leaderRows.map((l) => ({
      key: personKey("leader", l.id),
      kind: "leader" as const,
      id: l.id,
      lastName: l.lastName,
      firstName: l.firstName,
      middleInitial: "",
      nickname: l.nickname,
      mobileNumber: "",
      vglName: l.vgLeaderName,
      ministries: [l.isEnc ? "ENC" : "Leader"],
      detail: l.serviceGroup,
      registered: registered.get(personKey("leader", l.id)) ?? null,
    })),
    ...staffRows.map((s) => ({
      key: personKey("staff", s.id),
      kind: "staff" as const,
      id: s.id,
      lastName: s.lastName,
      firstName: s.firstName,
      middleInitial: "",
      nickname: s.nickname,
      mobileNumber: "",
      vglName: null,
      ministries: [s.ministry],
      detail: "Pastors & Staff",
      registered: registered.get(personKey("staff", s.id)) ?? null,
    })),
  ];
  return people;
}

// ---- Summary

export interface SummaryCounts {
  /** On the event's list (registered yes or no) */
  invited: number;
  willAttend: number;
  wontAttend: number;
  /** Checked in and pre-registered as attending */
  checkedIn: number;
  walkIns: number;
  /** checkedIn + walkIns */
  present: number;
}

export interface SummaryRow extends SummaryCounts {
  label: string;
}

export interface SummarySection {
  title: string;
  rows: SummaryRow[];
  /** Distinct people — an STM in two ministries counts once here */
  total: SummaryCounts;
}

export interface EventSummaryReport {
  /** STMs (and leaders) get one section per service group when the event spans several */
  sections: SummarySection[];
  grandTotal: SummaryCounts;
}

const zero = (): SummaryCounts => ({ invited: 0, willAttend: 0, wontAttend: 0, checkedIn: 0, walkIns: 0, present: 0 });

interface Tallied {
  registered: boolean | null;
  checkIn: { isWalkIn: boolean } | undefined;
}

function add(c: SummaryCounts, p: Tallied) {
  if (p.registered !== null) c.invited++;
  if (p.registered === true) c.willAttend++;
  if (p.registered === false) c.wontAttend++;
  if (p.checkIn) {
    c.present++;
    if (p.checkIn.isWalkIn) c.walkIns++;
    else c.checkedIn++;
  }
}

// Staff ministries in a sensible order; any others follow alphabetically
const STAFF_ORDER = ["Pastor", "Pastor's Wife", "Admin", "ENC", "Cross Cultural", "Maintenance", "Guard"];

/**
 * Counts like the masterlist's SUMMARY sheet: invited / will attend / won't, plus what
 * actually happened at the door (pre-registered check-ins and walk-ins). People who are
 * neither invited nor checked in are left out.
 */
export async function getEventSummary(eventId: number): Promise<EventSummaryReport> {
  const checkIns = await getEventPersonCheckIns(eventId);
  const byKey = new Map(checkIns.map((c) => [c.key, c]));
  const roster = await getEventRoster(eventId, new Set(byKey.keys()));
  const people = roster
    .map((p) => ({ ...p, checkIn: byKey.get(p.key) }))
    .filter((p) => p.registered !== null || p.checkIn);

  const section = (title: string, list: typeof people, labels: string[]): SummarySection => {
    const rows = labels.map((label) => {
      const c = { label, ...zero() };
      for (const p of list) if (p.ministries.includes(label)) add(c, p);
      return c;
    });
    const total = zero();
    for (const p of list) add(total, p);
    return { title, rows: rows.filter((r) => r.invited || r.present), total };
  };

  const stms = people.filter((p) => p.kind === "stm");
  const leaderList = people.filter((p) => p.kind === "leader");
  const staffList = people.filter((p) => p.kind === "staff");
  const staffLabels = [...new Set(staffList.flatMap((p) => p.ministries))].sort((a, b) => {
    const [ia, ib] = [STAFF_ORDER.indexOf(a), STAFF_ORDER.indexOf(b)];
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0 || ib >= 0) return ia >= 0 ? -1 : 1;
    return a.localeCompare(b);
  });

  // STMs and leaders are split into one section per service group when the event's people
  // come from more than one (e.g. 2PM & 4PM vs 6PM for the PM & 6PM night)
  const byGroup = (list: typeof people, groupOf: (p: (typeof people)[number]) => ServiceGroup | undefined) => {
    const groups = SERVICE_GROUP_NAMES.filter((g) => list.some((p) => groupOf(p) === g));
    const noGroup = list.filter((p) => !groupOf(p));
    if (groups.length + (noGroup.length ? 1 : 0) <= 1) return [{ suffix: "", list }];
    return [
      ...groups.map((g) => ({ suffix: ` · ${g}`, list: list.filter((p) => groupOf(p) === g) })),
      ...(noGroup.length ? [{ suffix: " · No service", list: noGroup }] : []),
    ];
  };

  const stmSections = byGroup(stms, (p) => groupOfAttending(p.detail)).map(({ suffix, list }) => {
    // Alphabetical, like the masterlist's summary sheet
    const sec = section(`Service team members${suffix}`, list, [...MINISTRY_OPTIONS].sort());
    const noMinistry = list.filter((p) => p.ministries.length === 0);
    if (noMinistry.length) {
      const c = { label: "No ministry", ...zero() };
      for (const p of noMinistry) add(c, p);
      sec.rows.push(c);
    }
    return sec;
  });
  const leaderSections = byGroup(leaderList, (p) => (isServiceGroup(p.detail) ? p.detail : undefined)).map(({ suffix, list }) =>
    section(`Leaders (no serve team)${suffix}`, list, ["Leader", "ENC"])
  );

  const sections = [...stmSections, ...leaderSections, section("Pastors & staff", staffList, staffLabels)].filter(
    (s) => s.total.invited || s.total.present
  );

  const grandTotal = zero();
  for (const p of people) add(grandTotal, p);

  return { sections, grandTotal };
}

/** Registered-as-attending count per event, for the events list. */
export async function getWillAttendCounts(eventIds: number[]): Promise<Map<number, number>> {
  if (!eventIds.length) return new Map();
  const rows = await db
    .select({ eventId: eventRegistrations.eventId })
    .from(eventRegistrations)
    .where(and(inArray(eventRegistrations.eventId, eventIds), eq(eventRegistrations.attending, true)));
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.eventId, (counts.get(r.eventId) ?? 0) + 1);
  return counts;
}
