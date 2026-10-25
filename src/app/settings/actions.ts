"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/access";
import { ACTIVITY_LIMITS, ACTIVITY_RULE_KEY, normalizeActivityRule } from "@/lib/activity-rule";

export type SettingsState = { error?: string; success?: string } | undefined;

export async function saveActivityRule(_: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireSuperAdmin();

  const minServes = Number(formData.get("minServes"));
  const withinDays = Number(formData.get("withinDays"));
  const { minServes: m, withinDays: w } = ACTIVITY_LIMITS;
  if (!Number.isInteger(minServes) || minServes < m.min || minServes > m.max) {
    return { error: `Times served must be a whole number from ${m.min} to ${m.max}.` };
  }
  if (!Number.isInteger(withinDays) || withinDays < w.min || withinDays > w.max) {
    return { error: `Days must be a whole number from ${w.min} to ${w.max}.` };
  }
  if (minServes > Math.ceil(withinDays / 7) * 7) return { error: "That's more serving days than the period has." };

  const value = normalizeActivityRule({ enabled: formData.get("enabled") === "on", minServes, withinDays });
  await db
    .insert(settings)
    .values({ key: ACTIVITY_RULE_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });

  // Every "active" count reads the rule
  revalidatePath("/", "layout");
  return { success: value.enabled ? "Activity rule turned on." : "Activity rule saved (off — everyone on the roster counts as active)." };
}
