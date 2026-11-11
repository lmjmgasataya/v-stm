"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { eventCheckIns, eventRegistrations, events, leaders, members, staff } from "@/db/schema";
import { parsePersonKey, type EventPerson, type EventPersonCheckIn, type PersonKind } from "@/lib/event-people-shared";
import { MINISTRY_OPTIONS, SERVICE_ATTENDING_OPTIONS } from "@/lib/constants";
import { isUniqueViolation } from "@/lib/db-errors";
import { requireMemberManager, requireSuperAdmin, requireViewer } from "@/lib/access";
import { isDateString } from "@/lib/date";
import { withToast } from "@/lib/toast";

export type EventFormState = { error?: string } | undefined;

const MAX_NAME_LENGTH = 100;
const MAX_NOTES_LENGTH = 500;

function readEventInput(formData: FormData) {
  const str = (key: string) => ((formData.get(key) as string | null) ?? "").trim();
  return { name: str("name"), eventDate: str("eventDate"), notes: str("notes"), preRegistration: formData.get("preRegistration") === "on" };
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
    .values({
      name: input.name,
      eventDate: input.eventDate,
      notes: input.notes || null,
      preRegistration: input.preRegistration,
      createdById: viewer.userId,
    })
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
    .set({ name: input.name, eventDate: input.eventDate, notes: input.notes || null, preRegistration: input.preRegistration })
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

/** On "already checked in", `checkedInAt` is the existing check-in, so the page can show it. */
export type EventCheckInResult = { ok: true; checkedInAt: string } | { ok: false; error: string; checkedInAt?: string };

// Event check-in/undo don't revalidateEvents(): revalidatePath inside a Server Action re-renders
// the whole event check-in page on the server for every tap. EventCheckInWorkspace keeps the
// result itself; the other pages are dynamic, so they're fresh on the next visit.

const PERSON_TABLES = { stm: members, leader: leaders, staff } as const;
const PERSON_COLUMNS = {
  stm: { checkIn: eventCheckIns.memberId, registration: eventRegistrations.memberId, field: "memberId" },
  leader: { checkIn: eventCheckIns.leaderId, registration: eventRegistrations.leaderId, field: "leaderId" },
  staff: { checkIn: eventCheckIns.staffId, registration: eventRegistrations.staffId, field: "staffId" },
} as const;

/** Any active STM, leader or pastor/staff, from any service — events aren't limited by service group. */
async function isActivePerson(kind: PersonKind, id: number) {
  const table = PERSON_TABLES[kind];
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.isActive, true)))
    .limit(1);
  return !!row;
}

/**
 * `personKey` = "stm-12" / "leader-3" / "staff-5". On a pre-registration event, anyone not
 * pre-registered as attending is still checked in, tagged as a walk-in (`isWalkIn` in the result).
 */
export async function checkInToEvent(
  eventId: number,
  personKey: string
): Promise<EventCheckInResult & { isWalkIn?: boolean }> {
  const viewer = await requireViewer();
  const person = parsePersonKey(personKey);
  if (!person || !(await isActivePerson(person.kind, person.id))) return { ok: false, error: "Person not found or inactive." };
  const cols = PERSON_COLUMNS[person.kind];

  const [event] = await db
    .select({ id: events.id, preRegistration: events.preRegistration })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return { ok: false, error: "This event no longer exists." };

  let isWalkIn = false;
  if (event.preRegistration) {
    const [registration] = await db
      .select({ attending: eventRegistrations.attending })
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, eventId), eq(cols.registration, person.id)))
      .limit(1);
    isWalkIn = !registration?.attending;
  }

  // The unique indexes make a repeat check-in a no-op, keeping the first time
  const [row] = await db
    .insert(eventCheckIns)
    .values({ eventId, [cols.field]: person.id, isWalkIn, checkedInById: viewer.userId })
    .onConflictDoNothing()
    .returning({ checkedInAt: eventCheckIns.checkedInAt });

  if (!row) {
    const [existing] = await db
      .select({ checkedInAt: eventCheckIns.checkedInAt, isWalkIn: eventCheckIns.isWalkIn })
      .from(eventCheckIns)
      .where(and(eq(eventCheckIns.eventId, eventId), eq(cols.checkIn, person.id)));
    return {
      ok: false,
      error: "Already checked in to this event.",
      checkedInAt: existing?.checkedInAt.toISOString(),
      isWalkIn: existing?.isWalkIn,
    };
  }
  return { ok: true, checkedInAt: row.checkedInAt.toISOString(), isWalkIn };
}

export async function undoEventCheckIn(eventId: number, personKey: string) {
  await requireViewer();
  const person = parsePersonKey(personKey);
  if (!person) return;
  await db.delete(eventCheckIns).where(and(eq(eventCheckIns.eventId, eventId), eq(PERSON_COLUMNS[person.kind].checkIn, person.id)));
}

export type NewWalkInResult = { ok: true; person: EventPerson; checkIn: EventPersonCheckIn } | { ok: false; error: string };

/**
 * Someone not in the app at all: adds them as an STM (name, ministry, service attending) and
 * checks them in — tagged as a walk-in on a pre-registration event. Open to every signed-in
 * user, since walk-ins arrive at the check-in table, not at an admin's desk.
 */
export async function addWalkIn(
  eventId: number,
  input: { lastName: string; firstName: string; ministry: string; serviceAttending: string }
): Promise<NewWalkInResult> {
  const viewer = await requireViewer();
  const lastName = input.lastName.trim().replace(/\s+/g, " ");
  const firstName = input.firstName.trim().replace(/\s+/g, " ");
  if (!lastName || !firstName) return { ok: false, error: "Last name and first name are required." };
  if (!(MINISTRY_OPTIONS as readonly string[]).includes(input.ministry)) return { ok: false, error: "Pick a ministry." };
  if (!(SERVICE_ATTENDING_OPTIONS as readonly string[]).includes(input.serviceAttending)) {
    return { ok: false, error: "Pick a service." };
  }

  const [event] = await db
    .select({ id: events.id, preRegistration: events.preRegistration })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return { ok: false, error: "This event no longer exists." };

  const alreadyThere = { ok: false as const, error: `${firstName} ${lastName} is already in the list — search for them above.` };
  let member: { id: number };
  try {
    [member] = await db
      .insert(members)
      .values({ lastName, firstName, ministries: [input.ministry], serviceAttending: input.serviceAttending })
      .returning({ id: members.id });
  } catch (err) {
    if (isUniqueViolation(err)) return alreadyThere;
    throw err;
  }

  const isWalkIn = event.preRegistration;
  const [row] = await db
    .insert(eventCheckIns)
    .values({ eventId, memberId: member.id, isWalkIn, checkedInById: viewer.userId })
    .returning({ checkedInAt: eventCheckIns.checkedInAt });

  // New STMs show up in the members list and dashboard too
  revalidatePath("/members");
  revalidatePath("/");

  const key = `stm-${member.id}`;
  return {
    ok: true,
    person: {
      key,
      kind: "stm",
      id: member.id,
      lastName,
      firstName,
      middleInitial: "",
      nickname: null,
      mobileNumber: "",
      vglName: null,
      ministries: [input.ministry],
      detail: input.serviceAttending,
      registered: null,
    },
    checkIn: { key, isWalkIn, checkedInAt: row.checkedInAt.toISOString() },
  };
}

/**
 * Sets someone's RSVP for an event: true = pre-registered (will attend), false = said no,
 * null = take them off the list. An existing check-in is re-tagged to match (walk-in unless
 * now pre-registered), so the summary stays consistent. Admins only.
 */
export async function setEventRegistration(
  eventId: number,
  personKey: string,
  attending: boolean | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireMemberManager();
  const person = parsePersonKey(personKey);
  if (!person) return { ok: false, error: "Person not found." };
  const cols = PERSON_COLUMNS[person.kind];

  const [event] = await db
    .select({ id: events.id, preRegistration: events.preRegistration })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return { ok: false, error: "This event no longer exists." };

  await db.transaction(async (tx) => {
    await tx.delete(eventRegistrations).where(and(eq(eventRegistrations.eventId, eventId), eq(cols.registration, person.id)));
    if (attending !== null) {
      await tx.insert(eventRegistrations).values({ eventId, [cols.field]: person.id, attending });
    }
    if (event.preRegistration) {
      await tx
        .update(eventCheckIns)
        .set({ isWalkIn: attending !== true })
        .where(and(eq(eventCheckIns.eventId, eventId), eq(cols.checkIn, person.id)));
    }
  });
  return { ok: true };
}
