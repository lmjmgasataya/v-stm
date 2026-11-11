// Types shared by the event check-in page (server) and EventCheckInWorkspace (client). No DB.

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
