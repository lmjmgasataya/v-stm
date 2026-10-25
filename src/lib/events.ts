import { notFound } from "next/navigation";
import { asc, count, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { eventCheckIns, events } from "@/db/schema";
import { manilaDateString } from "@/lib/date";

export interface EventSummary {
  id: number;
  name: string;
  eventDate: string;
  notes: string | null;
  checkedIn: number;
}

/**
 * Upcoming (today onward, soonest first) and past (latest first) events with check-in counts.
 * Events aren't limited by service group: every staff user sees and checks in every member.
 */
export async function getEventsWithCounts(): Promise<{ upcoming: EventSummary[]; past: EventSummary[] }> {
  const today = manilaDateString();
  const columns = { id: events.id, name: events.name, eventDate: events.eventDate, notes: events.notes };
  const [upcoming, past, counts] = await Promise.all([
    db.select(columns).from(events).where(gte(events.eventDate, today)).orderBy(asc(events.eventDate), asc(events.name)),
    db.select(columns).from(events).where(lt(events.eventDate, today)).orderBy(desc(events.eventDate), asc(events.name)),
    db
      .select({ eventId: eventCheckIns.eventId, total: count() })
      .from(eventCheckIns)
      .groupBy(eventCheckIns.eventId),
  ]);
  const byEvent = new Map(counts.map((c) => [c.eventId, c.total]));
  const withCount = (e: Omit<EventSummary, "checkedIn">) => ({ ...e, checkedIn: byEvent.get(e.id) ?? 0 });
  return { upcoming: upcoming.map(withCount), past: past.map(withCount) };
}

/** Events on one date — for the dashboard and attendance page. */
export async function getEventsOn(date: string) {
  return db
    .select({ id: events.id, name: events.name })
    .from(events)
    .where(eq(events.eventDate, date))
    .orderBy(asc(events.name));
}

export async function getEventOrNotFound(rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) notFound();
  return event;
}

export async function getEventCheckIns(eventId: number) {
  return db
    .select({ memberId: eventCheckIns.memberId, checkedInAt: eventCheckIns.checkedInAt })
    .from(eventCheckIns)
    .where(eq(eventCheckIns.eventId, eventId));
}
