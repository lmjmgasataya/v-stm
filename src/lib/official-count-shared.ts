import type { ServiceGroup } from "@/lib/constants";

// Official count constants used by the (client) table — no DB imports here.

/** Short column headings, like the masterlist */
export const GROUP_SHORT_LABELS: Record<ServiceGroup, string> = {
  "9AM & 11AM": "AM",
  "2PM & 4PM": "PM",
  "6PM": "6PM",
  "10AM & 1PM": "La Paz",
};

/** The section whose Total and Confirmed aren't counted (shown as "—"): pastors & staff */
export const NOT_COUNTED_SECTION = "Pastors & staff";
