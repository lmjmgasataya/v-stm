import type { SummaryCounts } from "@/lib/event-people";

// The event summary's columns, shared by the page and its Excel download so both look alike.
// Three hues carry meaning — teal = planned (the brand color), green = arrived as planned,
// amber = walk-in (same amber as walk-in tags elsewhere) — plus a soft red for "won't attend".
// Total present stands out by weight and a divider, not another color.

export type SummaryColumnGroup = "rsvp" | "door";

export const SUMMARY_GROUP_LABELS: Record<SummaryColumnGroup, string> = {
  rsvp: "RSVP",
  door: "At the door",
};

type Tint = "teal" | "red" | "green" | "amber" | "total";

export interface SummaryColumn {
  key: keyof SummaryCounts;
  label: string;
  group: SummaryColumnGroup;
  /** Only meaningful with pre-registration */
  preRegOnly?: boolean;
  tint?: Tint;
}

export const SUMMARY_COLUMNS: SummaryColumn[] = [
  { key: "invited", label: "Invited", group: "rsvp", preRegOnly: true },
  { key: "willAttend", label: "Will attend", group: "rsvp", preRegOnly: true, tint: "teal" },
  { key: "wontAttend", label: "Won't attend", group: "rsvp", preRegOnly: true, tint: "red" },
  { key: "checkedIn", label: "Checked in", group: "door", preRegOnly: true, tint: "green" },
  { key: "walkIns", label: "Walk-ins", group: "door", preRegOnly: true, tint: "amber" },
  { key: "present", label: "Total present", group: "door", tint: "total" },
];

export function summaryColumns(preRegistration: boolean): SummaryColumn[] {
  return SUMMARY_COLUMNS.filter((c) => preRegistration || !c.preRegOnly);
}

/**
 * Tailwind classes per tint. `text` is for non-zero values; `zero` keeps zeros quiet without
 * losing the column's band. Text colors keep ≥ 4.5:1 contrast on their background.
 */
export const TINT_CLASSES: Record<Tint, { bg: string; text: string; zero: string; head: string }> = {
  teal: { bg: "bg-teal-50", text: "text-teal-800", zero: "text-teal-300", head: "text-teal-800" },
  red: { bg: "bg-red-50", text: "text-red-700", zero: "text-red-300", head: "text-red-700" },
  green: { bg: "bg-emerald-50", text: "text-emerald-800", zero: "text-emerald-300", head: "text-emerald-800" },
  amber: { bg: "bg-amber-50", text: "text-amber-800", zero: "text-amber-300", head: "text-amber-800" },
  total: {
    bg: "bg-stone-100 border-l-2 border-stone-300",
    text: "text-stone-900 font-extrabold",
    zero: "text-stone-400 font-extrabold",
    head: "text-stone-800 font-extrabold",
  },
};

/** The same tints as hex, for the Excel download (Tailwind's 50 / 800 shades). */
export const TINT_HEX: Record<Tint, { bg: string; text: string }> = {
  teal: { bg: "#F0FDFA", text: "#115E59" },
  red: { bg: "#FEF2F2", text: "#B91C1C" },
  green: { bg: "#ECFDF5", text: "#065F46" },
  amber: { bg: "#FFFBEB", text: "#92400E" },
  total: { bg: "#F5F5F4", text: "#1C1917" },
};
