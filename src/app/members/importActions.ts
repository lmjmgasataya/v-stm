"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { memberScope, requireMemberManager, type Viewer } from "@/lib/access";
import { isUniqueViolation } from "@/lib/db-errors";
import { splitFullName } from "@/lib/csv";
import { MAX_NICKNAME_LENGTH, normalizeMobileNumber } from "@/lib/members";
import {
  MAX_IMPORT_ROWS,
  MEMBER_COLUMN_LABELS,
  parseAge,
  parseDiscipleshipJourney,
  parseEmail,
  parseGender,
  parseLifestage,
  parseMiddleInitial,
  parseMinistries,
  parseMemberId,
  parseService,
  parseYesNo,
  splitMiddleInitial,
  type ImportMapping,
  type MemberColumn,
  type Parsed,
} from "@/lib/member-import";
import { getActiveVgls, vglName } from "@/lib/vgl";

/**
 * new = added; update = an existing member gets the file's filled-in cells; unchanged = matched
 * an existing member but nothing differs; duplicate = skipped (already a member when not
 * updating, or repeated in the file); error = skipped.
 */
export type ImportRowStatus = "new" | "update" | "unchanged" | "duplicate" | "error";

export interface ImportPreviewRow {
  /** Row number in the file (1-based, as a spreadsheet shows it). */
  row: number;
  status: ImportRowStatus;
  lastName: string;
  firstName: string;
  middleInitial: string;
  nickname: string;
  mobileNumber: string;
  serviceAttending: string | null;
  ministries: string[];
  vglName: string | null;
  /** True when the VGL matched exactly one leader in v-1's list. */
  vglLinked: boolean;
  /** Why the row will be skipped (errors and duplicates), or what an update changes. */
  message?: string;
  /** Cells that couldn't be read and will be left blank; the row is still imported. */
  warnings: string[];
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  counts: Record<ImportRowStatus, number>;
}

export interface ImportSummary {
  imported: number;
  updated: number;
  unchanged: number;
  duplicates: number;
  errors: number;
}

type MemberInsert = typeof members.$inferInsert;
/** Columns an import can update (only those with a filled-in, readable cell are set). */
type MemberChanges = Partial<Omit<MemberInsert, "id" | "createdAt" | "updatedAt" | "isActive">>;

interface ImportEntry {
  row: ImportPreviewRow;
  /** The file's ID column (an export's member ID), if any */
  id: number | null;
  /** Full values for adding them as a new member */
  values: MemberInsert;
  /** Only the cells that were filled in — what an update writes, so blanks never erase data */
  changes: MemberChanges;
}

/** Field → label for "Updates: Age, Gender" */
const CHANGE_LABELS: Record<keyof MemberChanges, string> = {
  lastName: "Last name",
  firstName: "First name",
  middleInitial: "M.I.",
  nickname: "Nickname",
  mobileNumber: "Mobile",
  facebookMessengerName: "Messenger",
  lifestage: "Lifestage",
  age: "Age",
  gender: "Gender",
  serviceAttending: "Service",
  email: "Email",
  vglId: "VGL",
  vglName: "VGL",
  discipleshipJourneyCompleted: "Discipleship journey",
  ministries: "Ministry",
  profileSubmitted: "Profile submitted",
};

const INSERT_CHUNK_SIZE = 500;
const UPDATE_BATCH_SIZE = 20; // updates are one row each; run this many at a time
const MEMBER_COLUMNS = new Set<string>(Object.keys(MEMBER_COLUMN_LABELS));

// Same rule as stm_members_person_uq
const personKey = (lastName: string, firstName: string, mobileNumber: string) =>
  `${lastName.toLowerCase()}|${firstName.toLowerCase()}|${mobileNumber}`;

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Name → v-1 leader id, for "Maria Santos", "Santos, Maria" and "Mia Santos" (nickname).
 * Names shared by two leaders map to null (ambiguous → kept as free text).
 */
async function buildVglLookup() {
  const lookup = new Map<string, { id: number; name: string } | null>();
  for (const vgl of await getActiveVgls()) {
    const keys = new Set([squash(`${vgl.firstName}${vgl.lastName}`), squash(`${vgl.lastName}${vgl.firstName}`)]);
    if (vgl.nickname) keys.add(squash(`${vgl.nickname}${vgl.lastName}`));
    for (const key of keys) {
      // A second leader with the same name makes the key ambiguous
      lookup.set(key, lookup.has(key) ? null : { id: vgl.id, name: vglName(vgl) });
    }
  }
  return lookup;
}

/**
 * Turns the uploaded rows (parsed in the browser from .xlsx / CSV / tab-delimited text)
 * into member values using the column mapping confirmed on the review step, so column
 * order and header wording don't matter. Only the name is required; a cell that can't be
 * read (unknown gender, "9AM & 11AM" service, misspelled ministry…) is left blank and
 * listed as a warning. Repeats within the file are marked duplicates; members already in
 * the database are left to the unique index (see importMembers).
 */
async function buildImportRows(viewer: Viewer, rawRows: unknown, rawMapping: unknown) {
  const mapping = (rawMapping && typeof rawMapping === "object" ? rawMapping : {}) as Partial<ImportMapping>;
  const headerRow = Number.isInteger(mapping.headerRow) && mapping.headerRow! >= 0 ? mapping.headerRow! : null;
  // The import modal refuses bigger files; this just bounds the work
  const rows = (Array.isArray(rawRows) ? rawRows : [])
    .slice(0, (headerRow ?? -1) + 1 + MAX_IMPORT_ROWS)
    .map((r) => (Array.isArray(r) ? r.map((c) => (typeof c === "string" ? c : String(c ?? ""))) : []));

  const columns = new Map<MemberColumn, number>();
  (Array.isArray(mapping.columns) ? mapping.columns : []).forEach((field, index) => {
    if (typeof field === "string" && MEMBER_COLUMNS.has(field) && !columns.has(field as MemberColumn)) {
      columns.set(field as MemberColumn, index);
    }
  });

  const vglLookup = columns.has("vgl") ? await buildVglLookup() : new Map();
  const preview: ImportPreviewRow[] = [];
  const entries: ImportEntry[] = [];
  const seen = new Set<string>();
  const hasNameColumns = (columns.has("lastName") && columns.has("firstName")) || columns.has("fullName");

  rows.forEach((cols, i) => {
    if (headerRow !== null && i <= headerRow) return;
    const cell = (field: MemberColumn) => {
      const index = columns.get(field);
      return index === undefined ? "" : (cols[index] ?? "").trim();
    };

    let lastName = cell("lastName");
    let firstName = cell("firstName");
    if (columns.has("fullName") && (!lastName || !firstName)) {
      const split = splitFullName(cell("fullName"));
      lastName ||= split.lastName;
      firstName ||= split.firstName;
    }
    // "Juan P." in the first-name cell, when there's no separate M.I. column (or it's blank)
    let middleInitial = parseMiddleInitial(cell("middleInitial"));
    if (!middleInitial) ({ firstName, middleInitial } = splitMiddleInitial(firstName));
    const nickname = cell("nickname").slice(0, MAX_NICKNAME_LENGTH);

    const warnings: string[] = [];
    const read = <T,>(field: MemberColumn, parsed: Parsed<T>, fallback: T): T => {
      if ("value" in parsed) return parsed.value;
      warnings.push(`${MEMBER_COLUMN_LABELS[field]} "${parsed.invalid}" not recognized`);
      return fallback;
    };
    const age = read("age", parseAge(cell("age")), null);
    const gender = read("gender", parseGender(cell("gender")), null);
    const lifestage = read("lifestage", parseLifestage(cell("lifestage")), null);
    const serviceCell = cell("serviceAttending");
    const parsedService = parseService(serviceCell);
    // Service-group admins: every row must land in one of their services, or they'd never see it
    let serviceError: string | null = null;
    let serviceAttending: string | null = null;
    if (!viewer.serviceGroup) {
      serviceAttending = read("serviceAttending", parsedService, null);
    } else if ("value" in parsedService && parsedService.value && viewer.attending.includes(parsedService.value)) {
      serviceAttending = parsedService.value;
    } else if (!serviceCell && viewer.attending.length === 1) {
      serviceAttending = viewer.attending[0];
    } else {
      serviceError = serviceCell
        ? `Service "${serviceCell}" isn't one of your services (${viewer.attending.join(", ")}).`
        : `Service attending is required: ${viewer.attending.join(" or ")}.`;
    }
    const email = read("email", parseEmail(cell("email")), null);
    const profileSubmitted = read("profileSubmitted", parseYesNo(cell("profileSubmitted")), null);
    const id = parseMemberId(cell("id"));
    const ministries = parseMinistries(cell("ministries"));
    if (ministries.unknown.length) warnings.push(`Ministry not recognized: ${ministries.unknown.join(", ")}`);
    const journey = parseDiscipleshipJourney(cell("discipleshipJourneyCompleted"));
    if (journey.unknown.length) warnings.push(`Discipleship step not recognized: ${journey.unknown.join(", ")}`);

    const vglText = cell("vgl");
    const vgl = vglText ? vglLookup.get(squash(vglText)) : undefined;

    const mobileNumber = normalizeMobileNumber(cell("mobileNumber"));
    const row: ImportPreviewRow = {
      row: i + 1,
      status: "new",
      lastName,
      firstName,
      middleInitial,
      nickname,
      mobileNumber,
      serviceAttending,
      ministries: ministries.values,
      vglName: vgl?.name ?? (vglText || null),
      vglLinked: !!vgl,
      warnings,
    };
    preview.push(row);

    const fail = (message: string) => Object.assign(row, { status: "error", message });
    if (!hasNameColumns) return fail("Pick which column has the last and first name (or full name).");
    if (!lastName || !firstName) return fail("Last name and first name are required.");
    if (serviceError) return fail(serviceError);

    const key = id !== null ? `id:${id}` : personKey(lastName, firstName, mobileNumber);
    if (seen.has(key)) return Object.assign(row, { status: "duplicate", message: "Repeated in this file." });
    seen.add(key);

    const changes: MemberChanges = { lastName, firstName };
    if (middleInitial) changes.middleInitial = middleInitial;
    if (nickname) changes.nickname = nickname;
    if (mobileNumber) changes.mobileNumber = mobileNumber;
    if (cell("facebookMessengerName")) changes.facebookMessengerName = cell("facebookMessengerName");
    if (lifestage) changes.lifestage = lifestage;
    if (age !== null) changes.age = age;
    if (gender) changes.gender = gender;
    // Only a service actually in the file — a scoped admin's blank-service default is for new rows
    if (serviceCell && serviceAttending) changes.serviceAttending = serviceAttending;
    if (email) changes.email = email;
    if (vglText) Object.assign(changes, { vglId: vgl?.id ?? null, vglName: row.vglName });
    if (journey.values.length) changes.discipleshipJourneyCompleted = journey.values.join(",");
    if (ministries.values.length) changes.ministries = ministries.values;
    if (profileSubmitted !== null) changes.profileSubmitted = profileSubmitted;

    const values: MemberInsert = {
      lastName,
      firstName,
      middleInitial,
      nickname: nickname || null,
      // Kept as-is (minus spaces/dashes) rather than strictly validated: imported sheets
      // often carry landlines or old formats
      mobileNumber,
      facebookMessengerName: cell("facebookMessengerName") || null,
      lifestage,
      age,
      gender,
      serviceAttending,
      email,
      vglId: vgl?.id ?? null,
      vglName: row.vglName,
      discipleshipJourneyCompleted: journey.values.join(",") || null,
      ministries: ministries.values,
      profileSubmitted,
    };
    entries.push({ row, id, values, changes });
  });

  return { preview, entries };
}

function countStatuses(rows: ImportPreviewRow[]): Record<ImportRowStatus, number> {
  const counts = { new: 0, update: 0, unchanged: 0, duplicate: 0, error: 0 };
  for (const r of rows) counts[r.status]++;
  return counts;
}

const same = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b) ? a.join("|") === b.join("|") : (a ?? null) === (b ?? null);

/**
 * Decides what each importable row does, setting its preview status/message.
 * - Not updating: people already in the database (same name + mobile) are duplicates.
 * - Updating: a row matches an existing member within the viewer's services by its ID
 *   column, else by name + mobile, else by name alone when exactly one member has it.
 *   A match becomes an update (or "unchanged" when nothing differs); no match → new.
 * Returns the matched member id per update entry.
 */
async function resolveEntries(viewer: Viewer, entries: ImportEntry[], updateExisting: boolean) {
  const updates = new Map<ImportEntry, { memberId: number; changes: MemberChanges }>();

  if (!updateExisting) {
    const existing = await db
      .select({ lastName: members.lastName, firstName: members.firstName, mobileNumber: members.mobileNumber })
      .from(members);
    const existingKeys = new Set(existing.map((m) => personKey(m.lastName, m.firstName, m.mobileNumber)));
    for (const { row } of entries) {
      if (existingKeys.has(personKey(row.lastName, row.firstName, row.mobileNumber))) {
        Object.assign(row, { status: "duplicate", message: "Already a member." });
      }
    }
    return updates;
  }

  const existing = await db.select().from(members).where(memberScope(viewer));
  const byId = new Map(existing.map((m) => [m.id, m]));
  const byKey = new Map(existing.map((m) => [personKey(m.lastName, m.firstName, m.mobileNumber), m]));
  const byName = new Map<string, (typeof existing)[number][]>();
  for (const m of existing) {
    const k = `${m.lastName.toLowerCase()}|${m.firstName.toLowerCase()}`;
    byName.set(k, [...(byName.get(k) ?? []), m]);
  }

  const claimed = new Set<number>(); // two rows updating the same member → the second is a repeat
  for (const entry of entries) {
    const { row } = entry;
    let match: (typeof existing)[number] | undefined;
    if (entry.id !== null) {
      match = byId.get(entry.id);
      if (!match) {
        Object.assign(row, { status: "error", message: `ID ${entry.id} isn't a member in your services.` });
        continue;
      }
    } else {
      match = byKey.get(personKey(row.lastName, row.firstName, row.mobileNumber));
      if (!match) {
        const named = byName.get(`${row.lastName.toLowerCase()}|${row.firstName.toLowerCase()}`) ?? [];
        if (named.length > 1) {
          Object.assign(row, { status: "error", message: `${named.length} members have this name — add the ID column to pick one.` });
          continue;
        }
        match = named[0];
      }
    }
    if (!match) continue; // stays "new"
    if (claimed.has(match.id)) {
      Object.assign(row, { status: "duplicate", message: "Repeated in this file." });
      continue;
    }
    claimed.add(match.id);

    const changed = (Object.keys(entry.changes) as (keyof MemberChanges)[]).filter((f) => !same(entry.changes[f], match[f]));
    if (changed.length === 0) {
      Object.assign(row, { status: "unchanged", message: "Nothing new in this row." });
      continue;
    }
    const labels = [...new Set(changed.map((f) => CHANGE_LABELS[f]))];
    Object.assign(row, { status: "update", message: `Updates: ${labels.join(", ")}` });
    updates.set(entry, { memberId: match.id, changes: Object.fromEntries(changed.map((f) => [f, entry.changes[f]])) });
  }
  return updates;
}

/** Dry run for the import review step: what each row will do, without saving anything. */
export async function previewMemberImport(rows: string[][], mapping: ImportMapping, updateExisting = false): Promise<ImportPreview> {
  const viewer = await requireMemberManager();
  const { preview, entries } = await buildImportRows(viewer, rows, mapping);
  await resolveEntries(viewer, entries, updateExisting);
  return { rows: preview, counts: countStatuses(preview) };
}

/**
 * Saves the rows confirmed on the review step: new people are added (anyone matching an
 * existing member by name + mobile is skipped as a duplicate); with `updateExisting`, matched
 * members get the file's filled-in cells — blank cells never erase what's already saved.
 */
export async function importMembers(rows: string[][], mapping: ImportMapping, updateExisting = false): Promise<ImportSummary> {
  const viewer = await requireMemberManager();

  const { preview, entries } = await buildImportRows(viewer, rows, mapping);
  const updates = await resolveEntries(viewer, entries, updateExisting);
  const counts = countStatuses(preview);
  const toInsert = entries.filter((e) => e.row.status === "new").map((e) => e.values);

  let imported = 0;
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE);
    // Conflicts hit stm_members_person_uq — people already in the database
    const inserted = await db.insert(members).values(chunk).onConflictDoNothing().returning({ id: members.id });
    imported += inserted.length;
  }

  let updated = 0;
  let updateErrors = 0;
  const pending = [...updates.values()];
  for (let i = 0; i < pending.length; i += UPDATE_BATCH_SIZE) {
    await Promise.all(
      pending.slice(i, i + UPDATE_BATCH_SIZE).map(async ({ memberId, changes }) => {
        try {
          const done = await db
            .update(members)
            .set({ ...changes, updatedAt: new Date() })
            .where(and(eq(members.id, memberId), memberScope(viewer)))
            .returning({ id: members.id });
          if (done.length) updated++;
        } catch (err) {
          // e.g. a new mobile number that makes them identical to another member
          if (isUniqueViolation(err)) updateErrors++;
          else throw err;
        }
      })
    );
  }

  if (imported > 0 || updated > 0) revalidatePath("/", "layout");

  return {
    imported,
    updated,
    unchanged: counts.unchanged,
    duplicates: counts.duplicate + (toInsert.length - imported),
    errors: counts.error + updateErrors,
  };
}
