"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { members } from "@/db/schema";
import { memberScope, requireMemberManager, type Viewer } from "@/lib/access";
import { isUniqueViolation } from "@/lib/db-errors";
import { readMemberInput, toMemberValues, validateMemberInput } from "@/lib/members";
import { withToast } from "@/lib/toast";
import { resolveVgl } from "@/lib/vgl";

export type MemberFormState = { error?: string; success?: string } | undefined;

const DUPLICATE_MESSAGE = "This person (same name and mobile number) is already a service team member.";

async function readValidated(viewer: Viewer, formData: FormData) {
  const input = readMemberInput(formData);
  const error = validateMemberInput(input, viewer.services);
  if (error) return { error } as const;
  const vgl = await resolveVgl(input.vglId, input.vglName);
  return { values: toMemberValues({ ...input, ...vgl }) } as const;
}

export async function createMember(_: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const viewer = await requireMemberManager();

  const result = await readValidated(viewer, formData);
  if ("error" in result) return { error: result.error };

  try {
    await db.insert(members).values(result.values);
  } catch (err) {
    if (isUniqueViolation(err)) return { error: DUPLICATE_MESSAGE };
    throw err;
  }

  revalidatePath("/", "layout");
  const name = `${result.values.firstName} ${result.values.lastName}`;
  // "Save & add another" keeps the admin on the form (it resets itself on success)
  if (formData.get("intent") === "another") return { success: `${name} added.` };
  redirect(withToast("/members", "success", `${name} added.`));
}

export async function updateMember(memberId: number, _: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const viewer = await requireMemberManager();

  const result = await readValidated(viewer, formData);
  if ("error" in result) return { error: result.error };

  try {
    // memberScope: a service-group admin can only edit members of their own services
    const updated = await db
      .update(members)
      .set({ ...result.values, updatedAt: new Date() })
      .where(and(eq(members.id, memberId), memberScope(viewer)))
      .returning({ id: members.id });
    if (updated.length === 0) return { error: "This member no longer exists or isn't in your services." };
  } catch (err) {
    if (isUniqueViolation(err)) return { error: DUPLICATE_MESSAGE };
    throw err;
  }

  revalidatePath("/", "layout");
  redirect(withToast("/members", "success", "Service team member updated."));
}

/** Also deletes the member's check-ins (cascade). Prefer marking them inactive to keep attendance history. */
export async function deleteMember(memberId: number) {
  const viewer = await requireMemberManager();

  await db.delete(members).where(and(eq(members.id, memberId), memberScope(viewer)));
  revalidatePath("/", "layout");
  redirect(withToast("/members", "success", "Service team member deleted."));
}
