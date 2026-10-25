// Pure date helpers with no server-only imports, safe to use from Client Components.
// Asia/Manila is fixed UTC+8 with no DST, so conversions are a plain offset shift.

export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const TZ = "Asia/Manila";

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-PH", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/** Manila calendar date ("YYYY-MM-DD") of an instant, default now. */
export function manilaDateString(date: Date = new Date()): string {
  return new Date(date.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

export function isDateString(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** "2026-10-25" → "Sunday, October 25, 2026" */
export function formatDateString(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function isMonthString(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** "2026-10" shifted by `delta` months → "2026-11". */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
