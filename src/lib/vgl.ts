import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { v1VictoryGroupLeaders as vgl } from "@/db/v1";

export interface VglOption {
  id: number;
  name: string;
  /** Nickname and service, shown under the name in the autocomplete. */
  detail: string;
}

export function vglName(row: { firstName: string; lastName: string }) {
  return `${row.firstName} ${row.lastName}`;
}

/** Active, non-deleted VG leaders from v-1 — a few hundred rows, so callers load them all. */
export async function getActiveVgls() {
  return db
    .select({
      id: vgl.id,
      firstName: vgl.firstName,
      lastName: vgl.lastName,
      nickname: vgl.nickname,
      serviceAttending: vgl.serviceAttending,
    })
    .from(vgl)
    .where(and(eq(vgl.isActive, true), isNull(vgl.deletedAt)))
    .orderBy(asc(vgl.firstName), asc(vgl.lastName));
}

/** Options for the autocomplete. */
export async function getVglOptions(): Promise<VglOption[]> {
  return (await getActiveVgls()).map((row) => ({
    id: row.id,
    name: vglName(row),
    detail: [row.nickname && `"${row.nickname}"`, row.serviceAttending].filter(Boolean).join(" · "),
  }));
}

/**
 * Settles the VGL fields posted by VglAutocomplete. A picked leader (vglId) must still
 * exist in v-1 and its name is taken from there; otherwise the typed name is kept as free text.
 */
export async function resolveVgl(vglId: number | null, typedName: string): Promise<{ vglId: number | null; vglName: string }> {
  if (vglId === null) return { vglId: null, vglName: typedName };
  const [row] = await db
    .select({ firstName: vgl.firstName, lastName: vgl.lastName })
    .from(vgl)
    .where(and(eq(vgl.id, vglId), isNull(vgl.deletedAt)))
    .limit(1);
  return row ? { vglId, vglName: vglName(row) } : { vglId: null, vglName: typedName };
}
