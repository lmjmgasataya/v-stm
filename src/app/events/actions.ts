"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { eventCheckIns, events, members } from "@/db/schema";
import { requireMemberManager, requireSuperAdmin, requireViewer } from "@/lib/access";
import { isDateString } from "@/lib/date";
import { withToast } from "@/lib/toast";

export type EventFormState = { error?: string } | undefined;

const MAX_NAME_LENGTH = 100;
const MAX_NOTES_LENGTH = 500;

function readEventInput(formData: FormData) {
  const str = (key: string) => ((formData.get(key) as string | null) ?? "").trim();
  return { name: str("name"), eventDate: str("eventDate"), notes: str("notes") };
}

function validate(input: ReturnType<typeof readEventInput>): string | null {
  if (!input.name) return "Event name is required.";
  if (input.name.length > MAX_NAME_LENGTH) return `Event name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  if (!isDateString(input.eventDate)) return "Pick the event date.";
  if (input.notes.length > MAX_NOTES_LENGTH) return `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`;
  return null;
}

function revalidateEvents() {
  revalidatePath("/events", "layout");
  revalidatePath("/attendance");
  revalidatePath("/");
}

export async function createEvent(_: EventFormState, formData: FormData): Promise<EventFormState> {
  const viewer = await requireMemberManager();
  const input = readEventInput(formData);
  const error = validate(input);
  if (error) return { error };

  const [event] = await db
    .insert(events)
    .values({ name: input.name, eventDate: input.eventDate, notes: input.notes || null, createdById: viewer.userId })
    .returning({ id: events.id });

  revalidateEvents();
  redirect(withToast(`/events/${event.id}`, "success", `${input.name} created.`));
}

export async function updateEvent(eventId: number, _: EventFormState, formData: FormData): Promise<EventFormState> {
  await requireMemberManager();
  const input = readEventInput(formData);
  const error = validate(input);
  if (error) return { error };

  await db
    .update(events)
    .set({ name: input.name, eventDate: input.eventDate, notes: input.notes || null })
    .where(eq(events.id, eventId));

  revalidateEvents();
  redirect(withToast(`/events/${eventId}`, "success", "Event updated."));
}

/** All-services admins only: it also deletes every team's check-ins for the event (cascade). */
export async function deleteEvent(eventId: number) {
  await requireSuperAdmin();
  await db.delete(events).where(eq(events.id, eventId));
  revalidateEvents();
  redirect(withToast("/events", "success", "Event deleted."));
}

export type EventCheckInResult = { ok: true; checkedInAt: string } | { ok: false; error: string };

/** Any active member, from any service — events aren't limited by the viewer's service group. */
async function isActiveMember(memberId: number) {
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.isActive, true)))
    .limit(1);
  return !!member;
}

export async function checkInToEvent(eventId: number, memberId: number): Promise<EventCheckInResult> {
  const viewer = await requireViewer();
  if (!(await isActiveMember(memberId))) return { ok: false, error: "Member not found or inactive." };

  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return { ok: false, error: "This event no longer exists." };

  // The unique index makes a repeat check-in a no-op, keeping the first time
  const [row] = await db
    .insert(eventCheckIns)
    .values({ eventId, memberId, checkedInById: viewer.userId })
    .onConflictDoNothing()
    .returning({ checkedInAt: eventCheckIns.checkedInAt });

  revalidateEvents();
  if (!row) return { ok: false, error: "Already checked in to this event." };
  return { ok: true, checkedInAt: row.checkedInAt.toISOString() };
}

export async function undoEventCheckIn(eventId: number, memberId: number) {
  await requireViewer();
  await db.delete(eventCheckIns).where(and(eq(eventCheckIns.eventId, eventId), eq(eventCheckIns.memberId, memberId)));
  revalidateEvents();
}
