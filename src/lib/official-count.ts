import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { eventCheckIns, eventRegistrations, events, leaders, members, staff } from "@/db/schema";
import { MINISTRY_OPTIONS, SERVICE_GROUP_NAMES, groupOfAttending, type ServiceGroup } from "@/lib/constants";
import { NOT_COUNTED_SECTION } from "@/lib/official-count-shared";

export { GROUP_SHORT_LABELS, NOT_COUNTED_SECTION } from "@/lib/official-count-shared";

// The yearly "Service Team Members and Leaders Appreciation Night" (one event per service
// group, e.g. AM / PM & 6PM / La Paz) and its "official count" — the masterlist's SUMMARY sheet:
// invited per service, total, confirmed (will attend), plus who was actually present.

/** Events whose name contains this (any case) are part of the series */
export const APPRECIATION_NIGHT_NAME = "Service Team Members and Leaders Appreciation Night";

export interface OfficialCountRow {
  label: string;
  /** Invited per service group, in `groups` order */
  byGroup: number[];
  invited: number;
  confirmed: number;
  present: number;
}

export interface OfficialCount {
  year: string;
  /** Every year that has the event, latest first */
  years: string[];
  events: { id: number; name: string; eventDate: string }[];
  groups: ServiceGroup[];
  sections: { title: string; rows: OfficialCountRow[]; total: OfficialCountRow }[];
  grandTotal: OfficialCountRow;
}

type Kind = "stm" | "leader" | "staff";
interface Entry {
  kind: Kind;
  /** Ministry rows this person counts in */
  rows: string[];
  group: ServiceGroup | undefined;
  registered: boolean | null;
  present: boolean;
}

const seriesCondition = ilike(events.name, `%${APPRECIATION_NIGHT_NAME}%`);

/**
 * The official count for `year` (default: the latest year with the event), or null when
 * there's no such event at all. Each person counts once per night they're on the list (so
 * pastors & staff invited to all three nights count three times, as in the masterlist).
 * Service column: the person's own service group; pastors & staff use the night's first
 * invited service. Walk-ins count in Present only. Pastors & staff are listed (per service and
 * present) but left out of Total, Confirmed and the grand total.
 */
export async function getOfficialCount(year?: string): Promise<OfficialCount | null> {
  const yearRows = await db
    .selectDistinct({ year: sql<string>`extract(year from ${events.eventDate})::text` })
    .from(events)
    .where(seriesCondition)
    .orderBy(sql`1 desc`);
  const years = yearRows.map((r) => r.year);
  if (!years.length) return null;
  const chosen = year && years.includes(year) ? year : years[0];

  const nights = await db
    .select({ id: events.id, name: events.name, eventDate: events.eventDate, audienceGroups: events.audienceGroups })
    .from(events)
    .where(and(seriesCondition, sql`extract(year from ${events.eventDate}) = ${Number(chosen)}`))
    .orderBy(asc(events.eventDate));
  const eventIds = nights.map((n) => n.id);
  const nightGroup = new Map(nights.map((n) => [n.id, n.audienceGroups[0] as ServiceGroup | undefined]));

  const person = {
    memberId: members.id,
    serviceAttending: members.serviceAttending,
    ministries: members.ministries,
    leaderId: leaders.id,
    leaderGroup: leaders.serviceGroup,
    isEnc: leaders.isEnc,
    staffId: staff.id,
  };
  const [registrations, checkIns] = await Promise.all([
    db
      .select({ ...person, eventId: eventRegistrations.eventId, attending: eventRegistrations.attending })
      .from(eventRegistrations)
      .leftJoin(members, eq(eventRegistrations.memberId, members.id))
      .leftJoin(leaders, eq(eventRegistrations.leaderId, leaders.id))
      .leftJoin(staff, eq(eventRegistrations.staffId, staff.id))
      .where(inArray(eventRegistrations.eventId, eventIds)),
    db
      .select({ ...person, eventId: eventCheckIns.eventId })
      .from(eventCheckIns)
      .leftJoin(members, eq(eventCheckIns.memberId, members.id))
      .leftJoin(leaders, eq(eventCheckIns.leaderId, leaders.id))
      .leftJoin(staff, eq(eventCheckIns.staffId, staff.id))
      .where(inArray(eventCheckIns.eventId, eventIds)),
  ]);

  // One entry per person per night, from their registration and/or check-in
  const entries = new Map<string, Entry>();
  const entryFor = (r: (typeof checkIns)[number]): Entry => {
    const key = `${r.eventId}:${r.memberId ? `m${r.memberId}` : r.leaderId ? `l${r.leaderId}` : `s${r.staffId}`}`;
    let e = entries.get(key);
    if (!e) {
      if (r.memberId) {
        e = {
          kind: "stm",
          rows: r.ministries?.length ? r.ministries : ["No ministry"],
          group: groupOfAttending(r.serviceAttending),
          registered: null,
          present: false,
        };
      } else if (r.leaderId) {
        const g = r.leaderGroup as ServiceGroup | null;
        e = { kind: "leader", rows: [r.isEnc ? "ENC" : "Leaders"], group: g ?? nightGroup.get(r.eventId), registered: null, present: false };
      } else {
        e = { kind: "staff", rows: ["Pastors & Staff"], group: nightGroup.get(r.eventId), registered: null, present: false };
      }
      entries.set(key, e);
    }
    return e;
  };
  for (const r of registrations) entryFor(r).registered = r.attending;
  for (const r of checkIns) entryFor(r).present = true;

  const all = [...entries.values()];
  const groups = SERVICE_GROUP_NAMES.filter((g) => all.some((e) => e.group === g));

  const tally = (label: string, list: Entry[]): OfficialCountRow => ({
    label,
    byGroup: groups.map((g) => list.filter((e) => e.registered !== null && e.group === g).length),
    invited: list.filter((e) => e.registered !== null).length,
    confirmed: list.filter((e) => e.registered === true).length,
    present: list.filter((e) => e.present).length,
  });
  const section = (title: string, kind: Kind, labels: string[]) => {
    const list = all.filter((e) => e.kind === kind);
    return {
      title,
      rows: labels.map((l) => tally(l, list.filter((e) => e.rows.includes(l)))).filter((r) => r.invited || r.present),
      total: tally("Subtotal", list),
    };
  };

  const sections = [
    section("Service team members", "stm", [...[...MINISTRY_OPTIONS].sort(), "No ministry"]),
    section("Leaders (no serve team)", "leader", ["Leaders", "ENC"]),
    section(NOT_COUNTED_SECTION, "staff", ["Pastors & Staff"]),
  ].filter((s) => s.rows.length);

  return {
    year: chosen,
    years,
    events: nights.map(({ audienceGroups: _g, ...n }) => n),
    groups,
    sections,
    // Pastors & staff are shown but not counted in the grand total
    grandTotal: tally("Grand total", all.filter((e) => e.kind !== "staff")),
  };
}
