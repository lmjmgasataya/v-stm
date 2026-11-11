"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { leaders, staff } from "@/db/schema";
import { requireMemberManager } from "@/lib/access";
import { isServiceGroup } from "@/lib/constants";
import { isUniqueViolation } from "@/lib/db-errors";

export type SaveResult = { ok: true } | { ok: false; error: string };

const MAX = 80;
const str = (formData: FormData, key: string) => ((formData.get(key) as string | null) ?? "").trim().replace(/\s+/g, " ").slice(0, MAX);

const DUPLICATE = "Someone with this name is already in the list.";

function revalidate() {
  revalidatePath("/leaders");
  revalidatePath("/events", "layout");
}

/** Add (`id` null) or edit a leader without a serve team. Admins only. */
export async function saveLeader(id: number | null, formData: FormData): Promise<SaveResult> {
  await requireMemberManager();
  const lastName = str(formData, "lastName");
  const firstName = str(formData, "firstName");
  const serviceGroup = str(formData, "serviceGroup");
  if (!lastName || !firstName) return { ok: false, error: "Last name and first name are required." };
  if (serviceGroup && !isServiceGroup(serviceGroup)) return { ok: false, error: "Pick a valid service." };

  const values = {
    lastName,
    firstName,
    nickname: str(formData, "nickname") || null,
    serviceGroup: serviceGroup || null,
    isEnc: formData.get("isEnc") === "on",
    vgLeaderName: str(formData, "vgLeaderName") || null,
    isActive: id === null ? true : formData.get("isActive") === "on",
  };
  try {
    if (id === null) await db.insert(leaders).values(values);
    else {
      const updated = await db.update(leaders).set(values).where(eq(leaders.id, id)).returning({ id: leaders.id });
      if (!updated.length) return { ok: false, error: "This leader no longer exists." };
    }
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: DUPLICATE };
    throw err;
  }
  revalidate();
  return { ok: true };
}

/** Add (`id` null) or edit a pastor / staff member. Admins only. */
export async function saveStaff(id: number | null, formData: FormData): Promise<SaveResult> {
  await requireMemberManager();
  const lastName = str(formData, "lastName");
  const firstName = str(formData, "firstName");
  const ministry = str(formData, "ministry");
  if (!firstName) return { ok: false, error: "First name is required." };
  if (!ministry) return { ok: false, error: "Ministry is required." };

  const values = {
    lastName, // '' when they go by one name
    firstName,
    nickname: str(formData, "nickname") || null,
    ministry,
    isActive: id === null ? true : formData.get("isActive") === "on",
  };
  try {
    if (id === null) await db.insert(staff).values(values);
    else {
      const updated = await db.update(staff).set(values).where(eq(staff.id, id)).returning({ id: staff.id });
      if (!updated.length) return { ok: false, error: "This person no longer exists." };
    }
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: DUPLICATE };
    throw err;
  }
  revalidate();
  return { ok: true };
}
