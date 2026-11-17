"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, members } from "@/db/schema";
import { canSeeService, memberScope, requireViewer, type Viewer } from "@/lib/access";
import { isDateString, manilaDateString } from "@/lib/date";

// Manual corrections on Sunday Attendance: add or remove a service check-in on any date up to
// today (a missed check-in, someone checked in to the wrong service). Admins only, within
// their services — volunteers just use Sunday Check-in on the day.

export interface ManualCheckInMember {
  id: number;
  lastName: string;
  firstName: string;
  middleInitial: string;
  nickname: string | null;
  mobileNumber: string;
  vglName: string | null;
  ministries: string[];
  serviceAttending: string | null;
  status: string;
}

type Result = { ok: true; message: string } | { ok: false; error: string };

async function requireEditor(): Promise<Viewer | null> {
  const viewer = await requireViewer();
  return viewer.canManageMembers ? viewer : null;
}

function checkDate(date: string): string | null {
  if (!isDateString(date)) return "Invalid date.";
  if (date > manilaDateString()) return "You can't add check-ins for a future date.";
  return null;
}

/** Every member in the admin's services (inactive ones too — they may have served back then). */
export async function getManualCheckInMembers(): Promise<ManualCheckInMember[]> {
  const viewer = await requireEditor();
  if (!viewer) return [];
  return db
    .select({
      id: members.id,
      lastName: members.lastName,
      firstName: members.firstName,
      middleInitial: members.middleInitial,
      nickname: members.nickname,
      mobileNumber: members.mobileNumber,
      vglName: members.vglName,
      ministries: members.ministries,
      serviceAttending: members.serviceAttending,
      status: members.status,
    })
    .from(members)
    .where(memberScope(viewer))
    .orderBy(asc(members.lastName), asc(members.firstName));
}

/** Records a check-in for `memberId` on `date` to each of `services`; existing ones are kept as they are. */
export async function addManualCheckIn(memberId: number, date: string, services: string[]): Promise<Result> {
  const viewer = await requireEditor();
  if (!viewer) return { ok: false, error: "Only admins can change attendance." };
  const dateError = checkDate(date);
  if (dateError) return { ok: false, error: dateError };
  const wanted = [...new Set(services)];
  if (wanted.length === 0) return { ok: false, error: "Select at least one service." };
  if (!wanted.every((s) => canSeeService(viewer, s))) return { ok: false, error: "That service isn't one of yours." };

  const [member] = await db
    .select({ id: members.id, firstName: members.firstName, lastName: members.lastName })
    .from(members)
    .where(and(eq(members.id, memberId), memberScope(viewer)))
    .limit(1);
  if (!member) return { ok: false, error: "Member not found in your services." };

  const inserted = await db
    .insert(checkIns)
    .values(wanted.map((service) => ({ memberId, service, serviceDate: date, checkedInById: viewer.userId })))
    .onConflictDoNothing()
    .returning({ service: checkIns.service });

  revalidatePath("/attendance");
  const name = `${member.firstName} ${member.lastName}`;
  if (inserted.length === 0) return { ok: true, message: `${name} was already checked in.` };
  return { ok: true, message: `Checked in ${name} to ${inserted.map((r) => r.service).join(" and ")}.` };
}

/** Removes one service check-in on `date`. */
export async function removeCheckIn(memberId: number, date: string, service: string): Promise<Result> {
  const viewer = await requireEditor();
  if (!viewer) return { ok: false, error: "Only admins can change attendance." };
  if (!isDateString(date)) return { ok: false, error: "Invalid date." };
  if (!canSeeService(viewer, service)) return { ok: false, error: "That service isn't one of yours." };

  const deleted = await db
    .delete(checkIns)
    .where(and(eq(checkIns.memberId, memberId), eq(checkIns.serviceDate, date), eq(checkIns.service, service)))
    .returning({ id: checkIns.id });

  revalidatePath("/attendance");
  return deleted.length ? { ok: true, message: "Check-in removed." } : { ok: false, error: "That check-in was already removed." };
}
