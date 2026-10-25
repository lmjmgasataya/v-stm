"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { checkIns, members } from "@/db/schema";
import { canSeeService, memberScope, requireViewer } from "@/lib/access";
import { manilaDateString } from "@/lib/date";

export type CheckInResult =
  | {
      ok: true;
      /** Newly recorded check-ins. */
      checkedIn: { service: string; checkedInAt: string }[];
      /** Services the member was already checked in to today (kept as they were). */
      already: string[];
    }
  | { ok: false; error: string };

function revalidateAttendance() {
  revalidatePath("/check-in");
  revalidatePath("/attendance");
  revalidatePath("/");
}

/** Checks a member in to one or more services today (Manila date) — e.g. both 2PM and 4PM. */
export async function checkIn(memberId: number, services: string[]): Promise<CheckInResult> {
  const viewer = await requireViewer();
  const wanted = [...new Set(services)];
  if (wanted.length === 0) return { ok: false, error: "Select at least one service." };
  if (!wanted.every((s) => canSeeService(viewer, s))) return { ok: false, error: "That service isn't one of yours." };

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.isActive, true), memberScope(viewer)))
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

  revalidateAttendance();

  const done = new Set(inserted.map((r) => r.service));
  return {
    ok: true,
    checkedIn: inserted.map((r) => ({ service: r.service, checkedInAt: r.checkedInAt.toISOString() })),
    already: wanted.filter((s) => !done.has(s)),
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

  revalidateAttendance();
}
