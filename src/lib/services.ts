import { SERVICE_ATTENDING_BY_GROUP, SERVICE_ATTENDING_OPTIONS, SERVICE_OPTIONS, groupOfService } from "@/lib/constants";

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

/**
 * Maps a free-text service onto one of SERVICE_ATTENDING_OPTIONS (a member's service group):
 *   "9AM & 11AM - Mandurriao", "9am", "11:00 AM", "AM"  → "9AM & 11AM - Mandurriao"
 *   "2 & 4PM", "4pm", "PM"                              → "2PM & 4PM - Mandurriao"
 *   "6PM"                                               → "6PM - Mandurriao"
 *   "La Paz", "10am", "1PM Lapaz"                       → "10AM & 1PM - Lapaz"
 * Anything else (several groups, unknown times) → null.
 */
export function normalizeAttending(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!value) return null;
  const compact = value.toLowerCase().replace(/[^a-z0-9&:]/g, "");

  const exact = SERVICE_ATTENDING_OPTIONS.find((o) => o.toLowerCase().replace(/[^a-z0-9&:]/g, "") === compact);
  if (exact) return exact;
  if (compact.includes("lapaz")) return SERVICE_ATTENDING_BY_GROUP["10AM & 1PM"];
  if (compact === "am") return SERVICE_ATTENDING_BY_GROUP["9AM & 11AM"];
  if (compact === "pm") return SERVICE_ATTENDING_BY_GROUP["2PM & 4PM"];

  // Every time named must fall in the same group: "2 & 4PM" → 2PM & 4PM
  const meridiem = /pm/.test(compact) ? "PM" : /am/.test(compact) ? "AM" : "";
  const place = compact.includes("mandurriao") ? " Mandurriao" : "";
  const hours = compact.match(HOUR_PATTERN);
  if (!hours) return null;
  const groups = new Set(
    hours.map((h) => {
      const service = normalizeService(`${parseInt(h, 10)}${meridiem}${place}`);
      return service ? groupOfService(service) : undefined;
    })
  );
  const [group] = groups;
  return groups.size === 1 && group ? SERVICE_ATTENDING_BY_GROUP[group] : null;
}
