// Pure (client-safe) activity rule types and helpers. Read the stored rule with getActivityRule in src/lib/settings.ts.

/**
 * When enabled, a member counts as active only if they served (checked in to any
 * service) on at least `minServes` different days within the last `withinDays` days —
 * e.g. 1 in 30 = "serves once a month". Off by default: every member on the roster
 * (isActive) counts as active. Check-in itself never uses this rule.
 */
export interface ActivityRule {
  enabled: boolean;
  minServes: number;
  withinDays: number;
}

export const ACTIVITY_RULE_KEY = "activity_rule";
export const DEFAULT_ACTIVITY_RULE: ActivityRule = { enabled: false, minServes: 1, withinDays: 30 };
export const ACTIVITY_LIMITS = { minServes: { min: 1, max: 52 }, withinDays: { min: 7, max: 365 } };

function clampInt(value: unknown, { min, max }: { min: number; max: number }, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function normalizeActivityRule(value: unknown): ActivityRule {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof ActivityRule, unknown>>;
  return {
    enabled: v.enabled === true,
    minServes: clampInt(v.minServes, ACTIVITY_LIMITS.minServes, DEFAULT_ACTIVITY_RULE.minServes),
    withinDays: clampInt(v.withinDays, ACTIVITY_LIMITS.withinDays, DEFAULT_ACTIVITY_RULE.withinDays),
  };
}

/** "Served at least once in the last 30 days" */
export function describeActivityRule(rule: ActivityRule): string {
  const times = rule.minServes === 1 ? "once" : rule.minServes === 2 ? "twice" : `${rule.minServes} times`;
  return `Served at least ${times} in the last ${rule.withinDays} days`;
}
