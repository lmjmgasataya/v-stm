// Types shared by the event check-in page (server) and EventCheckInWorkspace (client). No DB.

import { groupOfAttending } from "@/lib/constants";

/** stm = stm_members, leader = stm_leaders, staff = stm_staff */
export type PersonKind = "stm" | "leader" | "staff";

export const PERSON_KINDS: PersonKind[] = ["stm", "leader", "staff"];

export const PERSON_KIND_LABELS: Record<PersonKind, string> = {
  stm: "STMs",
  leader: "Leaders",
  staff: "Pastors & Staff",
};

export interface EventPerson {
  /** `${kind}-${id}`, unique across the three tables */
  key: string;
  kind: PersonKind;
  id: number;
  lastName: string;
  firstName: string;
  middleInitial: string;
  nickname: string | null;
  mobileNumber: string;
  /** STM: their VGL; leader: their own VG leader */
  vglName: string | null;
  /** STM: ministries; leader: ["Leader"] or ["ENC"]; staff: [their ministry] */
  ministries: string[];
  /** STM: service attending; leader: service group; staff: "Pastors & Staff" */
  detail: string | null;
  /** This event's RSVP: true = pre-registered (will attend), false = said no, null = not on the list */
  registered: boolean | null;
}

export interface EventPersonCheckIn {
  key: string;
  isWalkIn: boolean;
  checkedInAt: string;
}

export function parsePersonKey(key: string): { kind: PersonKind; id: number } | null {
  const match = /^(stm|leader|staff)-(\d+)$/.exec(key);
  return match ? { kind: match[1] as PersonKind, id: Number(match[2]) } : null;
}

export interface EventAudience {
  /** SERVICE_GROUPS keys; [] = every service */
  audienceGroups: string[];
  /** PersonKind values */
  audienceKinds: string[];
}

/**
 * Whether the event invites this person: their kind is included and, for STMs and leaders,
 * their service group is one of the event's (pastors & staff serve every service, and a
 * leader with no service group recorded is never left out).
 */
export function inAudience(person: Pick<EventPerson, "kind" | "detail">, audience: EventAudience): boolean {
  if (!audience.audienceKinds.includes(person.kind)) return false;
  if (person.kind === "staff" || audience.audienceGroups.length === 0) return true;
  // STM detail = service attending ("2PM & 4PM - Mandurriao"), leader detail = group ("2PM & 4PM")
  const group = person.kind === "stm" ? groupOfAttending(person.detail) : person.detail;
  return !group || audience.audienceGroups.includes(group);
}

/** "9AM & 11AM, 6PM · STMs, Leaders" — for the event header. */
export function describeAudience(audience: EventAudience): string {
  const services = audience.audienceGroups.length ? audience.audienceGroups.join(", ") : "All services";
  const kinds = PERSON_KINDS.filter((k) => audience.audienceKinds.includes(k)).map((k) => PERSON_KIND_LABELS[k]);
  return `${services} · ${kinds.join(", ")}`;
}
