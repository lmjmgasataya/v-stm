import { and, eq, not, sql, type SQL } from "drizzle-orm";
import { members } from "@/db/schema";
import { manilaDateString } from "@/lib/date";
import type { ActivityRule } from "@/lib/activity-rule";

// SQL for "is this member active?" — the manual roster flag, plus the serving activity
// rule when it's enabled (see ActivityRule). Used by the dashboard, members list and
// reports so they all agree. Check-in deliberately uses only members.isActive.

// Always table-qualified: in a single-table SELECT list Drizzle renders `${members.id}` as a bare
// "id", which inside these subqueries would resolve to stm_check_ins.id instead of the member.
const MEMBER_ID = sql.raw(`"stm_members"."id"`);

/** First Manila date inside the rule's window ("served since"). */
export function activitySince(rule: ActivityRule): string {
  return manilaDateString(new Date(Date.now() - (rule.withinDays - 1) * 24 * 60 * 60 * 1000));
}

/** Days served (distinct service dates) within the rule's window, per member row. */
export function daysServedSql(rule: ActivityRule): SQL<number> {
  return sql<number>`(select count(distinct c.service_date)::int from stm_check_ins c where c.member_id = ${MEMBER_ID} and c.service_date >= ${activitySince(rule)})`;
}

/**
 * Last service date ("YYYY-MM-DD") the member checked in to, any time. Cast to text: a raw
 * `date` from a sql`` subquery would come back from node-postgres as a JS Date at local midnight.
 */
export const lastServedSql = sql<string | null>`(select max(c.service_date)::text from stm_check_ins c where c.member_id = ${MEMBER_ID})`;

export function activeMemberCondition(rule: ActivityRule): SQL {
  const onRoster = eq(members.isActive, true);
  return rule.enabled ? and(onRoster, sql`${daysServedSql(rule)} >= ${rule.minServes}`)! : onRoster;
}

export function inactiveMemberCondition(rule: ActivityRule): SQL {
  return not(activeMemberCondition(rule));
}
