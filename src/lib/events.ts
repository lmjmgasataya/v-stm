import { cache } from "react";
import { notFound } from "next/navigation";
import { asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { eventCheckIns, events } from "@/db/schema";
import { manilaDateString } from "@/lib/date";
import { getWillAttendCounts } from "@/lib/event-people";

export interface EventSummary {
  id: number;
  name: string;
  eventDate: string;
  notes: string | null;
  preRegistration: boolean;
  checkedIn: number;
  /** Pre-registered as attending (pre-registration events only) */
  willAttend: number;
}

/**
 * Upcoming (today onward, soonest first) and past (latest first) events with check-in counts.
 * Events aren't limited by service group: every staff user sees and checks in every member.
 */
export async function getEventsWithCounts(): Promise<{ upcoming: EventSummary[]; past: EventSummary[] }> {
  const today = manilaDateString();
  const columns = {
    id: events.id,
    name: events.name,
    eventDate: events.eventDate,
    notes: events.notes,
    preRegistration: events.preRegistration,
  };
  const [upcoming, past, counts] = await Promise.all([
    db.select(columns).from(events).where(gte(events.eventDate, today)).orderBy(asc(events.eventDate), asc(events.name)),
    db.select(columns).from(events).where(lt(events.eventDate, today)).orderBy(desc(events.eventDate), asc(events.name)),
    db
      .select({ eventId: eventCheckIns.eventId, total: count() })
      .from(eventCheckIns)
      .groupBy(eventCheckIns.eventId),
  ]);
  const byEvent = new Map(counts.map((c) => [c.eventId, c.total]));
  const willAttend = await getWillAttendCounts([...upcoming, ...past].filter((e) => e.preRegistration).map((e) => e.id));
  const withCount = (e: Omit<EventSummary, "checkedIn" | "willAttend">) => ({
    ...e,
    checkedIn: byEvent.get(e.id) ?? 0,
    willAttend: willAttend.get(e.id) ?? 0,
  });
  return { upcoming: upcoming.map(withCount), past: past.map(withCount) };
}

/** Events on one date with their check-in counts (and pre-registered count) — for the dashboard. */
export async function getEventsOn(date: string) {
  const dayEvents = await db
    .select({ id: events.id, name: events.name, preRegistration: events.preRegistration })
    .from(events)
    .where(eq(events.eventDate, date))
    .orderBy(asc(events.name));
  if (!dayEvents.length) return [];
  const ids = dayEvents.map((e) => e.id);
  const [counts, willAttend] = await Promise.all([
    db
      .select({
        eventId: eventCheckIns.eventId,
        checkedIn: count(),
        walkIns: sql<number>`count(*) filter (where ${eventCheckIns.isWalkIn})`.mapWith(Number),
      })
      .from(eventCheckIns)
      .where(inArray(eventCheckIns.eventId, ids))
      .groupBy(eventCheckIns.eventId),
    getWillAttendCounts(ids),
  ]);
  const byEvent = new Map(counts.map((c) => [c.eventId, c]));
  return dayEvents.map((e) => ({
    ...e,
    checkedIn: byEvent.get(e.id)?.checkedIn ?? 0,
    walkIns: byEvent.get(e.id)?.walkIns ?? 0,
    willAttend: willAttend.get(e.id) ?? 0,
  }));
}

/** Cached per request: the event layout and its page both load it. */
export const getEventOrNotFound = cache(async (rawId: string) => {
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) notFound();
  return event;
});

