"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, members } from "@/db/schema";
import { canSeeService, memberScope, requireViewer } from "@/lib/access";
import { checkInEligibleCondition } from "@/lib/activity";
import { GENDER_OPTIONS, MINISTRY_OPTIONS, memberStatusValues } from "@/lib/constants";
import { manilaDateString } from "@/lib/date";
import { isUniqueViolation } from "@/lib/db-errors";

export type CheckInResult =
  | {
      ok: true;
      /** Newly recorded check-ins. */
      checkedIn: { service: string; checkedInAt: string }[];
      /** Services the member was already checked in to today (kept as they were), with their time. */
      already: { service: string; checkedInAt: string }[];
    }
  | { ok: false; error: string };

// No revalidatePath here: inside a Server Action it re-renders the whole check-in page on the
// server for every tap. CheckInWorkspace keeps the result itself; /attendance and / are
// dynamic, so they're fresh on the next visit.

/** Checks a member in to one or more services today (Manila date) — e.g. both 2PM and 4PM. */
export async function checkIn(memberId: number, services: string[]): Promise<CheckInResult> {
  const viewer = await requireViewer();
  const wanted = [...new Set(services)];
  if (wanted.length === 0) return { ok: false, error: "Select at least one service." };
  if (!wanted.every((s) => canSeeService(viewer, s))) return { ok: false, error: "That service isn't one of yours." };

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, memberId), checkInEligibleCondition, memberScope(viewer)))
    .limit(1);
  if (!member) return { ok: false, error: "Member not found in your services." };

  const serviceDate = manilaDateString();
  // The unique index makes a repeat check-in (another device, double tap) a no-op,
  // so the original check-in time is kept.
  const inserted = await db
    .insert(checkIns)
    .values(wanted.map((service) => ({ memberId, service, serviceDate, checkedInById: viewer.userId })))
    .onConflictDoNothing()
    .returning({ service: checkIns.service, checkedInAt: checkIns.checkedInAt });

  const done = new Set(inserted.map((r) => r.service));
  const alreadyServices = wanted.filter((s) => !done.has(s));
  const already = alreadyServices.length
    ? await db
        .select({ service: checkIns.service, checkedInAt: checkIns.checkedInAt })
        .from(checkIns)
        .where(and(eq(checkIns.memberId, memberId), eq(checkIns.serviceDate, serviceDate), inArray(checkIns.service, alreadyServices)))
    : [];
  return {
    ok: true,
    checkedIn: inserted.map((r) => ({ service: r.service, checkedInAt: r.checkedInAt.toISOString() })),
    already: already.map((r) => ({ service: r.service, checkedInAt: r.checkedInAt.toISOString() })),
  };
}

export async function undoCheckIn(memberId: number, service: string) {
  const viewer = await requireViewer();
  if (!canSeeService(viewer, service)) return;

  await db
    .delete(checkIns)
    .where(
      and(eq(checkIns.memberId, memberId), eq(checkIns.service, service), eq(checkIns.serviceDate, manilaDateString()))
    );
}

export type AddMemberResult =
  | {
      ok: true;
      member: {
        id: number;
        lastName: string;
        firstName: string;
        serviceAttending: string;
        ministries: string[];
        /** Added by a volunteer: waits for an admin's approval. */
        pending: boolean;
      };
      checkedIn: { service: string; checkedInAt: string }[];
    }
  | { ok: false; error: string };

/**
 * Adds someone who isn't in the list yet as an STM and checks them in to `services` today.
 * Open to every signed-in user: a volunteer's addition is saved as **pending** until an admin
 * approves it (dashboard → pending approval); an admin's is active straight away.
 */
export async function addMemberAtCheckIn(
  input: { lastName: string; firstName: string; gender: string; ministry: string; serviceAttending: string },
  services: string[]
): Promise<AddMemberResult> {
  const viewer = await requireViewer();
  const lastName = input.lastName.trim().replace(/\s+/g, " ");
  const firstName = input.firstName.trim().replace(/\s+/g, " ");
  if (!lastName || !firstName) return { ok: false, error: "Last name and first name are required." };
  if (!(GENDER_OPTIONS as readonly string[]).includes(input.gender)) return { ok: false, error: "Pick a gender." };
  if (!(MINISTRY_OPTIONS as readonly string[]).includes(input.ministry)) return { ok: false, error: "Pick a ministry." };
  if (!viewer.attending.includes(input.serviceAttending)) return { ok: false, error: "Pick one of your services." };
  const wanted = [...new Set(services)];
  if (wanted.length === 0) return { ok: false, error: "Select at least one service." };
  if (!wanted.every((s) => canSeeService(viewer, s))) return { ok: false, error: "That service isn't one of yours." };

  const pending = !viewer.canManageMembers;
  let member: { id: number };
  try {
    [member] = await db
      .insert(members)
      .values({
        lastName,
        firstName,
        gender: input.gender,
        ministries: [input.ministry],
        serviceAttending: input.serviceAttending,
        ...memberStatusValues(pending ? "pending" : "active"),
      })
      .returning({ id: members.id });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        // Not found by the search, so they're either not active or in a service this user can't see
        error: `${firstName} ${lastName} is already a service team member (maybe not active, or in another service). Please ask an admin.`,
      };
    }
    throw err;
  }

  const inserted = await db
    .insert(checkIns)
    .values(wanted.map((service) => ({ memberId: member.id, service, serviceDate: manilaDateString(), checkedInById: viewer.userId })))
    .returning({ service: checkIns.service, checkedInAt: checkIns.checkedInAt });

  return {
    ok: true,
    member: { id: member.id, lastName, firstName, serviceAttending: input.serviceAttending, ministries: [input.ministry], pending },
    checkedIn: inserted.map((r) => ({ service: r.service, checkedInAt: r.checkedInAt.toISOString() })),
  };
}
