import { SERVICE_OPTIONS } from "@/lib/constants";

// Pure helpers, safe to use from Client Components and scripts.

const HOUR_PATTERN = /\d{1,2}(?::\d{2})?/g;

/**
 * Maps a free-text "Service Attended" value onto one of SERVICE_OPTIONS:
 *   "9AM", "9 am", "9:00AM Mandurriao" → "9AM - Mandurriao"
 *   "10AM - LaPaz", "10am"             → "10AM - Lapaz"
 * A value that names a time but doesn't match exactly one slot ("2 & 4PM", "8AM")
 * becomes null (blank). A value with no time at all ("Life Iloilo") is a named
 * non-regular service and is kept as typed.
 */
export function normalizeService(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return null;

  const exact = SERVICE_OPTIONS.find((o) => o.toLowerCase() === value.toLowerCase());
  if (exact) return exact;

  const compact = value.toLowerCase().replace(/\s+/g, "");
  const hours = compact.match(HOUR_PATTERN);
  if (!hours) return value; // no time → named service like "Life Iloilo"
  if (hours.length !== 1) return null; // "2 & 4PM" — can't tell which slot

  const hour = parseInt(hours[0], 10);
  const meridiem = /pm/.test(compact) ? "PM" : /am/.test(compact) ? "AM" : null;
  const location = /lapaz/.test(compact) ? "Lapaz" : /mandurriao/.test(compact) ? "Mandurriao" : null;

  const candidates = SERVICE_OPTIONS.filter((option) => {
    const [time, place] = option.split(" - ");
    const optionHour = parseInt(time, 10);
    const optionMeridiem = time.slice(-2);
    return (
      optionHour === hour &&
      (meridiem === null || meridiem === optionMeridiem) &&
      (location === null || location === place)
    );
  });
  return candidates.length === 1 ? candidates[0] : null;
}
