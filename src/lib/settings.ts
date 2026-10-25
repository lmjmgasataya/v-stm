import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { ACTIVITY_RULE_KEY, normalizeActivityRule, type ActivityRule } from "@/lib/activity-rule";

export async function getActivityRule(): Promise<ActivityRule> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, ACTIVITY_RULE_KEY)).limit(1);
  return normalizeActivityRule(row?.value);
}
