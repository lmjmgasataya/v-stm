// Column mapping and lenient value parsing for the Excel/CSV member import.
// Pure, safe to use from Client Components (the import modal) and server actions.

import { toCsv } from "@/lib/csv";
import {
  DISCIPLESHIP_JOURNEY_STEPS,
  GENDER_OPTIONS,
  LIFESTAGE_OPTIONS,
  MINISTRY_OPTIONS,
  SERVICE_OPTIONS,
} from "@/lib/constants";
import { normalizeService } from "@/lib/services";

export type MemberColumn =
  | "lastName"
  | "firstName"
  | "fullName" // split into first/last name when there are no separate name columns
  | "middleInitial"
  | "nickname"
  | "mobileNumber"
  | "facebookMessengerName"
  | "lifestage"
  | "age"
  | "gender"
  | "serviceAttending"
  | "email"
  | "vgl"
  | "discipleshipJourneyCompleted"
  | "ministries";

export const MEMBER_COLUMN_LABELS: Record<MemberColumn, string> = {
  lastName: "Last name",
  firstName: "First name",
  fullName: "Full name (split into first + last)",
  middleInitial: "Middle initial",
  nickname: "Nickname",
  mobileNumber: "Mobile number",
  facebookMessengerName: "Facebook Messenger name",
  lifestage: "Lifestage",
  age: "Age",
  gender: "Gender",
  serviceAttending: "Service attending",
  email: "Email",
  vgl: "VGL",
  discipleshipJourneyCompleted: "Discipleship journey completed",
  ministries: "Ministry",
};

/** Header row of the downloadable template, in this order. */
export const MEMBER_IMPORT_HEADERS = [
  "Last Name",
  "First Name",
  "Middle Initial",
  "Nickname",
  "Mobile Number",
  "Facebook Messenger Name",
  "Lifestage",
  "Age",
  "Gender",
  "Service Attending",
  "Email",
  "VGL",
  "Discipleship Journey Completed",
  "Ministry",
] as const;

const TEMPLATE_EXAMPLE_ROW = [
  "Dela Cruz",
  "Juan",
  "P",
  "Jun",
  "09171234567",
  "Juan Dela Cruz",
  "Single",
  "28",
  "Male",
  "9AM - Mandurriao",
  "juan@example.com",
  "Maria Santos",
  "One2One; Victory Weekend/Victory Day",
  "Music; Tech",
];

// Headers are matched after lowercasing and stripping everything but letters, so
// "Last Name", "last_name", "LASTNAME" and "Mobile No." all resolve.
const HEADER_ALIASES: Record<string, MemberColumn> = {
  lastname: "lastName",
  surname: "lastName",
  familyname: "lastName",
  firstname: "firstName",
  givenname: "firstName",
  name: "fullName",
  fullname: "fullName",
  completename: "fullName",
  middleinitial: "middleInitial",
  mi: "middleInitial",
  middlename: "middleInitial",
  nickname: "nickname",
  nick: "nickname",
  alias: "nickname",
  preferredname: "nickname",
  callname: "nickname",
  mobilenumber: "mobileNumber",
  mobileno: "mobileNumber",
  mobile: "mobileNumber",
  contactnumber: "mobileNumber",
  contactno: "mobileNumber",
  contact: "mobileNumber",
  phonenumber: "mobileNumber",
  phone: "mobileNumber",
  cellphonenumber: "mobileNumber",
  facebookmessengername: "facebookMessengerName",
  messengername: "facebookMessengerName",
  facebookname: "facebookMessengerName",
  messenger: "facebookMessengerName",
  facebook: "facebookMessengerName",
  fbname: "facebookMessengerName",
  lifestage: "lifestage",
  age: "age",
  gender: "gender",
  sex: "gender",
  serviceattending: "serviceAttending",
  serviceattended: "serviceAttending",
  service: "serviceAttending",
  worshipservice: "serviceAttending",
  email: "email",
  emailaddress: "email",
  vgl: "vgl",
  vgleader: "vgl",
  victorygroupleader: "vgl",
  vglname: "vgl",
  discipleshipjourneycompleted: "discipleshipJourneyCompleted",
  discipleshipjourney: "discipleshipJourneyCompleted",
  ministry: "ministries",
  ministries: "ministries",
};

const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z]/g, "");
/** Letters and digits only, for loose value matching ("one 2 one" vs "One2One"). */
const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Maps each known column to its index in the header row; unknown headers are ignored. */
function mapHeaders(headerRow: string[]): Partial<Record<MemberColumn, number>> {
  const map: Partial<Record<MemberColumn, number>> = {};
  headerRow.forEach((header, index) => {
    const column = HEADER_ALIASES[normalizeHeader(header)];
    if (column && map[column] === undefined) map[column] = index;
  });
  return map;
}

/** What each file column is imported as (null = ignored). Chosen on the import review step. */
export interface ImportMapping {
  /** Index of the header row in the file (rows above it are skipped), or null when every row is data. */
  headerRow: number | null;
  columns: (MemberColumn | null)[];
}

const HEADER_SCAN_ROWS = 10;

/** Data rows per import (not counting the header and anything above it). */
export const MAX_IMPORT_ROWS = 5000;

const nameColumnsFound = (map: Partial<Record<MemberColumn, number>>) =>
  (map.lastName !== undefined && map.firstName !== undefined) || map.fullName !== undefined;

/**
 * Finds the header row among the first few rows (sheets often have a title or blank
 * rows above it): the first row naming the name column(s), else the row matching the
 * most known headers, else null (no header — every row is data).
 */
export function detectHeaderRow(rows: string[][]): number | null {
  let best: { index: number; matches: number } | null = null;
  for (const [index, row] of rows.slice(0, HEADER_SCAN_ROWS).entries()) {
    const map = mapHeaders(row);
    if (nameColumnsFound(map)) return index;
    const matches = Object.keys(map).length;
    if (matches > 0 && (!best || matches > best.matches)) best = { index, matches };
  }
  return best?.index ?? null;
}

/** Fills in the column mapping from the header row (unrecognized headers are ignored). */
export function autoMapColumns(rows: string[][], headerRow: number | null): (MemberColumn | null)[] {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const columns: (MemberColumn | null)[] = Array(width).fill(null);
  if (headerRow === null) {
    // No headers: a plain list of names, one per line
    if (width === 1) columns[0] = "fullName";
    return columns;
  }
  const map = mapHeaders(rows[headerRow] ?? []);
  // Separate name columns win over a full-name column
  if (map.lastName !== undefined && map.firstName !== undefined) delete map.fullName;
  for (const [column, index] of Object.entries(map)) columns[index] = column as MemberColumn;
  return columns;
}

export function buildMemberImportTemplate(): string {
  return toCsv([[...MEMBER_IMPORT_HEADERS], TEMPLATE_EXAMPLE_ROW]);
}

// ---- Value parsing. Each returns the stored value, or `invalid` when the cell had
// something that couldn't be read (the row is still imported, with that field blank).

export type Parsed<T> = { value: T } | { invalid: string };

/** "Juan P." / "Juan P" → first "Juan", middle initial "P". Only when there's a name before it. */
export function splitMiddleInitial(firstName: string): { firstName: string; middleInitial: string } {
  const match = /^(.*\S)\s+([A-Za-z])\.?$/.exec(firstName.trim());
  return match ? { firstName: match[1], middleInitial: match[2].toUpperCase() } : { firstName, middleInitial: "" };
}

/** "P.", "p", or a whole middle name ("Pascual") → "P". */
export function parseMiddleInitial(raw: string): string {
  const letters = raw.replace(/[^A-Za-z]/g, "");
  if (!letters) return "";
  // An abbreviation like "D.C." keeps both letters; a spelled-out name becomes its initial
  return (/\./.test(raw) || letters.length <= 2 ? letters : letters[0]).toUpperCase().slice(0, 3);
}

export function parseGender(raw: string): Parsed<string | null> {
  const key = squash(raw);
  if (!key) return { value: null };
  if (key === "m" || key === "male") return { value: "Male" };
  if (key === "f" || key === "female") return { value: "Female" };
  const exact = GENDER_OPTIONS.find((g) => squash(g) === key);
  return exact ? { value: exact } : { invalid: raw };
}

export function parseAge(raw: string): Parsed<number | null> {
  const value = raw.trim();
  if (!value) return { value: null };
  const age = Number(value);
  return Number.isInteger(age) && age >= 1 && age <= 120 ? { value: age } : { invalid: raw };
}

export function parseLifestage(raw: string): Parsed<string | null> {
  const key = squash(raw);
  if (!key) return { value: null };
  const exact = LIFESTAGE_OPTIONS.find((o) => squash(o) === key);
  if (exact) return { value: exact };
  if (key === "college" || key === "collegestudent") return { value: "Student (College)" };
  if (["jhs", "shs", "highschool", "jhsshs", "highschoolstudent"].includes(key)) return { value: "Student (JHS/SHS)" };
  if (key === "widow" || key === "widower") return { value: "Widow/Widower" };
  return { invalid: raw };
}

/** Free-text service ("9am", "9:00 AM Mandurriao") → a SERVICE_OPTIONS value. */
export function parseService(raw: string): Parsed<string | null> {
  if (!raw.trim()) return { value: null };
  const service = normalizeService(raw);
  return service && (SERVICE_OPTIONS as readonly string[]).includes(service) ? { value: service } : { invalid: raw };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(raw: string): Parsed<string | null> {
  const value = raw.trim().toLowerCase();
  if (!value) return { value: null };
  return EMAIL_REGEX.test(value) ? { value } : { invalid: raw };
}

/**
 * Splits a multi-value cell ("Music; Tech", "Music, Tech", one per line) and matches each
 * part to `options` loosely — "Music Team" → Music, "Ushering" → Usher. Returns the matches
 * in the options' own order, plus the parts that didn't match anything.
 */
function parseList(
  raw: string,
  options: readonly string[],
  aliases: Record<string, string> = {}
): { values: string[]; unknown: string[] } {
  const chosen = new Set<string>();
  const unknown: string[] = [];
  for (const part of raw.split(/[;,|\n]/).map((p) => p.trim()).filter(Boolean)) {
    const key = squash(part);
    const match =
      options.find((o) => squash(o) === key) ??
      aliases[key] ??
      options.find((o) => key.includes(squash(o)));
    if (match) chosen.add(match);
    else unknown.push(part);
  }
  return { values: options.filter((o) => chosen.has(o)), unknown };
}

export function parseMinistries(raw: string) {
  return parseList(raw, MINISTRY_OPTIONS, {
    worship: "Music",
    musicteam: "Music",
    ushering: "Usher",
    ushers: "Usher",
    intercession: "Prayer",
    comms: "Communication",
    communications: "Communication",
    kidschurch: "Kids",
    kc: "Kids",
  });
}

export function parseDiscipleshipJourney(raw: string) {
  return parseList(raw, DISCIPLESHIP_JOURNEY_STEPS, {
    onetoone: "One2One",
    one2one: "One2One",
    victoryweekend: "Victory Weekend/Victory Day",
    victoryday: "Victory Weekend/Victory Day",
    vw: "Victory Weekend/Victory Day",
    sf: "Spiritual Foundations",
    pbc: "Purple Book Class",
    md: "Making Disciples",
    el: "Empowering Leaders",
  });
}
