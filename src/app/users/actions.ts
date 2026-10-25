"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/access";
import { ROLE_OPTIONS, isServiceGroup } from "@/lib/constants";
import { isUniqueViolation } from "@/lib/db-errors";
import { withToast } from "@/lib/toast";

export type UserFormState = { error?: string } | undefined;

const MIN_PASSWORD_LENGTH = 8;

function readUserInput(formData: FormData) {
  const str = (key: string) => ((formData.get(key) as string | null) ?? "").trim();
  return {
    username: str("username").toLowerCase(),
    name: str("name"),
    role: str("role"),
    serviceGroup: str("serviceGroup"),
    password: (formData.get("password") as string | null) ?? "",
  };
}

function validate(input: ReturnType<typeof readUserInput>, { passwordRequired }: { passwordRequired: boolean }) {
  if (!/^[a-z0-9._-]{3,40}$/.test(input.username)) {
    return "Username must be 3–40 characters: letters, numbers, dot, dash or underscore.";
  }
  if (!input.name) return "Name is required.";
  if (!(ROLE_OPTIONS as readonly string[]).includes(input.role)) return "Select a role.";
  if (input.serviceGroup && !isServiceGroup(input.serviceGroup)) return "Select a valid service group.";
  if ((passwordRequired || input.password) && input.password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export async function createUser(_: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireSuperAdmin();
  const input = readUserInput(formData);
  const error = validate(input, { passwordRequired: true });
  if (error) return { error };

  try {
    await db.insert(users).values({
      username: input.username,
      name: input.name,
      role: input.role,
      serviceGroup: input.serviceGroup || null,
      passwordHash: await bcrypt.hash(input.password, 12),
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: `Username "${input.username}" is already taken.` };
    throw err;
  }

  revalidatePath("/users");
  redirect(withToast("/users", "success", `${input.name} added.`));
}

export async function updateUser(userId: number, _: UserFormState, formData: FormData): Promise<UserFormState> {
  const viewer = await requireSuperAdmin();
  const input = readUserInput(formData);
  const error = validate(input, { passwordRequired: false });
  if (error) return { error };

  // Don't let the signed-in admin remove their own all-services admin access
  const isSelf = userId === viewer.userId;
  if (isSelf && (input.role !== "admin" || input.serviceGroup)) {
    return { error: "You can't change your own role or service group — ask another all-services admin." };
  }

  try {
    await db
      .update(users)
      .set({
        username: input.username,
        name: input.name,
        role: input.role,
        serviceGroup: input.serviceGroup || null,
        ...(input.password && { passwordHash: await bcrypt.hash(input.password, 12) }),
      })
      .where(eq(users.id, userId));
  } catch (err) {
    if (isUniqueViolation(err)) return { error: `Username "${input.username}" is already taken.` };
    throw err;
  }

  revalidatePath("/users");
  redirect(withToast("/users", "success", `${input.name} updated.`));
}

/** Their past check-ins stay; checkedInById is set to null. */
export async function deleteUser(userId: number) {
  const viewer = await requireSuperAdmin();
  if (userId === viewer.userId) redirect(withToast("/users", "error", "You can't delete your own account."));

  await db.delete(users).where(eq(users.id, userId));
  revalidatePath("/users");
  redirect(withToast("/users", "success", "User deleted."));
}
