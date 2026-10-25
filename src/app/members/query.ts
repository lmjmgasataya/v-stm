import { and, arrayContains, asc, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { members } from "@/db/schema";
import { memberScope, type Viewer } from "@/lib/access";
import { activeMemberCondition, inactiveMemberCondition } from "@/lib/activity";
import type { ActivityRule } from "@/lib/activity-rule";
import { MINISTRY_OPTIONS, SERVICE_OPTIONS } from "@/lib/constants";
import { parseSort, type SortDir } from "@/lib/sort";
import { MEMBER_SORT_COLUMNS, type MemberSortColumn } from "./sortColumns";

// The members list's search / filters / sort, shared by the page and the Excel export so an
// export always contains exactly what the list shows (every page of it).

export const PAGE_SIZE = 50;

export type MemberStatus = "active" | "inactive" | "all";

export interface MemberListParams {
  q: string;
  ministry: string;
  /** Selected services (subset of the viewer's); empty = all of them. */
  services: string[];
  status: MemberStatus;
  sort: MemberSortColumn;
  dir: SortDir;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const all = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Reads `?q=&ministry=&service=…&service=…&status=&sort=&dir=&page=`, dropping anything invalid. */
export function parseMemberListParams(raw: RawParams | URLSearchParams, viewer: Viewer): MemberListParams {
  const get = (key: string) => (raw instanceof URLSearchParams ? (raw.get(key) ?? undefined) : first(raw[key]));
  const getAll = (key: string) => (raw instanceof URLSearchParams ? raw.getAll(key) : all(raw[key]));

  const ministry = get("ministry") ?? "";
  const status = get("status");
  const { sort, dir } = parseSort(get("sort"), get("dir"), MEMBER_SORT_COLUMNS, "lastName");
  const page = Number(get("page"));
  return {
    q: get("q") ?? "",
    ministry: (MINISTRY_OPTIONS as readonly string[]).includes(ministry) ? ministry : "",
    // Keep the viewer's own order (9AM, 11AM, …) and only services they may see
    services: viewer.services.filter((s) => getAll("service").includes(s)),
    status: status === "inactive" || status === "all" ? status : "active",
    sort,
    dir,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function memberListWhere(p: MemberListParams, viewer: Viewer, rule: ActivityRule): SQL | undefined {
  // Service-group users only ever see their own services' members
  const conditions: (SQL | undefined)[] = [memberScope(viewer)];
  // Every word must match some column, so "Jun Dela Cruz" (nickname + last name) or
  // "Juan Dela Cruz" finds the member even though no single column holds the whole phrase
  for (const word of p.q.trim().split(/\s+/).filter(Boolean)) {
    const like = `%${word.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(members.firstName, like),
        ilike(members.nickname, like),
        ilike(members.lastName, like),
        ilike(members.mobileNumber, like),
        ilike(members.email, like),
        ilike(members.vglName, like)
      )
    );
  }
  if (p.ministry) conditions.push(arrayContains(members.ministries, [p.ministry]));
  if (p.services.length) conditions.push(inArray(members.serviceAttending, p.services));
  // Active/Inactive follow the activity rule when it's on (Settings), else the roster flag
  if (p.status === "active") conditions.push(activeMemberCondition(rule));
  if (p.status === "inactive") conditions.push(inactiveMemberCondition(rule));
  return and(...conditions);
}

export function memberListOrder(p: MemberListParams): SQL[] {
  const column = members[p.sort];
  const direction = p.dir === "asc" ? sql`asc` : sql`desc`;
  // Service sorts by time slot order (SERVICE_OPTIONS)
  const primary =
    p.sort === "serviceAttending"
      ? sql`array_position(ARRAY[${sql.join(
          SERVICE_OPTIONS.map((s) => sql`${s}`),
          sql`, `
        )}]::text[], ${column})`
      : column;
  // mobileNumber stores '' for unknown, so treat it as blank too
  const blank = p.sort === "mobileNumber" ? sql`nullif(${column}, '')` : column;
  return [
    sql`${blank} is null`, // blanks always last, whichever direction
    sql`${primary} ${direction}`,
    asc(members.lastName),
    asc(members.firstName),
    asc(members.id), // stable order so pages never overlap or skip
  ];
}

/** The list's query string without `page` — for the export link and pagination. */
export function memberListQuery(p: MemberListParams, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  if (p.q) params.set("q", p.q);
  if (p.ministry) params.set("ministry", p.ministry);
  for (const s of p.services) params.append("service", s);
  if (p.status !== "active") params.set("status", p.status);
  if (p.sort !== "lastName" || p.dir !== "asc") {
    params.set("sort", p.sort);
    params.set("dir", p.dir);
  }
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return params.toString();
}
