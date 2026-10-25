"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { members } from "@/db/schema";
import { requireMemberManager, type Viewer } from "@/lib/access";
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
  parseService,
  splitMiddleInitial,
  type ImportMapping,
  type MemberColumn,
  type Parsed,
} from "@/lib/member-import";
import { getActiveVgls, vglName } from "@/lib/vgl";

export type ImportRowStatus = "new" | "duplicate" | "error";

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
  /** Why the row will be skipped (errors and duplicates). */
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
  duplicates: number;
  errors: number;
}

const INSERT_CHUNK_SIZE = 500;
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
  const values: (typeof members.$inferInsert)[] = [];
  const valueRows: ImportPreviewRow[] = []; // preview row for each entry in values
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
    } else if ("value" in parsedService && parsedService.value && viewer.services.includes(parsedService.value)) {
      serviceAttending = parsedService.value;
    } else if (!serviceCell && viewer.services.length === 1) {
      serviceAttending = viewer.services[0];
    } else {
      serviceError = serviceCell
        ? `Service "${serviceCell}" isn't one of your services (${viewer.services.join(", ")}).`
        : `Service attending is required: ${viewer.services.join(" or ")}.`;
    }
    const email = read("email", parseEmail(cell("email")), null);
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

    const key = personKey(lastName, firstName, mobileNumber);
    if (seen.has(key)) return Object.assign(row, { status: "duplicate", message: "Repeated in this file." });
    seen.add(key);

    values.push({
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
    });
    valueRows.push(row);
  });

  return { preview, values, valueRows };
}

function countStatuses(rows: ImportPreviewRow[]): Record<ImportRowStatus, number> {
  const counts = { new: 0, duplicate: 0, error: 0 };
  for (const r of rows) counts[r.status]++;
  return counts;
}

/** Dry run for the import review step: what each row will do, without saving anything. */
export async function previewMemberImport(rows: string[][], mapping: ImportMapping): Promise<ImportPreview> {
  const viewer = await requireMemberManager();

  const { preview, valueRows } = await buildImportRows(viewer, rows, mapping);

  const existing = await db
    .select({ lastName: members.lastName, firstName: members.firstName, mobileNumber: members.mobileNumber })
    .from(members);
  const existingKeys = new Set(existing.map((m) => personKey(m.lastName, m.firstName, m.mobileNumber)));
  for (const row of valueRows) {
    if (existingKeys.has(personKey(row.lastName, row.firstName, row.mobileNumber))) {
      Object.assign(row, { status: "duplicate", message: "Already a member." });
    }
  }

  return { rows: preview, counts: countStatuses(preview) };
}

/**
 * Imports the rows confirmed on the review step. Rows matching an existing member
 * (same name + mobile number) are skipped and counted as duplicates, so re-importing
 * an updated sheet only adds the new people.
 */
export async function importMembers(rows: string[][], mapping: ImportMapping): Promise<ImportSummary> {
  const viewer = await requireMemberManager();

  const { preview, values } = await buildImportRows(viewer, rows, mapping);
  const counts = countStatuses(preview);

  let imported = 0;
  for (let i = 0; i < values.length; i += INSERT_CHUNK_SIZE) {
    const chunk = values.slice(i, i + INSERT_CHUNK_SIZE);
    // Conflicts hit stm_members_person_uq — people already in the database
    const inserted = await db.insert(members).values(chunk).onConflictDoNothing().returning({ id: members.id });
    imported += inserted.length;
  }

  if (imported > 0) revalidatePath("/", "layout");

  return { imported, duplicates: counts.duplicate + (values.length - imported), errors: counts.error };
}
