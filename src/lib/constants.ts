// Matches v-1's `lifestage` values so data lines up across apps.
export const LIFESTAGE_OPTIONS = [
  "Student (JHS/SHS)",
  "Student (College)",
  "Single",
  "Married",
  "Single Parent",
  "Widow/Widower",
  "Senior",
] as const;

// Matches v-1's raw worship service values.
export const SERVICE_OPTIONS = [
  "9AM - Mandurriao",
  "11AM - Mandurriao",
  "2PM - Mandurriao",
  "4PM - Mandurriao",
  "6PM - Mandurriao",
  "10AM - Lapaz",
  "1PM - Lapaz",
] as const;

// Each staff user can be tied to one group and then only sees members, check-ins and
// attendance for those services. Users with no group (null) see every service.
export const SERVICE_GROUPS = {
  "9AM & 11AM": ["9AM - Mandurriao", "11AM - Mandurriao"],
  "2PM & 4PM": ["2PM - Mandurriao", "4PM - Mandurriao"],
  "6PM": ["6PM - Mandurriao"],
  "10AM & 1PM": ["10AM - Lapaz", "1PM - Lapaz"],
} as const satisfies Record<string, readonly (typeof SERVICE_OPTIONS)[number][]>;

export type ServiceGroup = keyof typeof SERVICE_GROUPS;
export const SERVICE_GROUP_NAMES = Object.keys(SERVICE_GROUPS) as ServiceGroup[];

export function isServiceGroup(value: unknown): value is ServiceGroup {
  return typeof value === "string" && value in SERVICE_GROUPS;
}

/** The group a service belongs to ("2PM - Mandurriao" → "2PM & 4PM"). */
export function groupOfService(service: string): ServiceGroup | undefined {
  return SERVICE_GROUP_NAMES.find((g) => (SERVICE_GROUPS[g] as readonly string[]).includes(service));
}

export const ROLE_OPTIONS = ["admin", "volunteer"] as const;

export const GENDER_OPTIONS = ["Male", "Female"] as const;

// Same steps (and order) as v-1's DISCIPLESHIP_JOURNEY_STEPS.
export const DISCIPLESHIP_JOURNEY_STEPS = [
  "One2One",
  "Victory Weekend/Victory Day",
  "Spiritual Foundations",
  "Church Community",
  "Purple Book Class",
  "Making Disciples",
  "Empowering Leaders",
] as const;

export const MINISTRY_OPTIONS = [
  "Music",
  "Tech",
  "Admin",
  "Usher",
  "Prayer",
  "Production",
  "Communication",
  "Kids",
] as const;

export type Ministry = (typeof MINISTRY_OPTIONS)[number];

// Shown next to the ministry name everywhere it appears (emoji so it also works in <option>s)
export const MINISTRY_ICONS: Record<Ministry, string> = {
  Music: "🎵",
  Tech: "💻",
  Admin: "📋",
  Usher: "🤝",
  Prayer: "🙏",
  Production: "🎨",
  Communication: "📷",
  Kids: "🧒",
};

export function ministryIcon(ministry: string): string | undefined {
  return MINISTRY_ICONS[ministry as Ministry];
}

/** "🎵 Music" — for plain-text spots (dropdown options, joined lists). In JSX use <MinistryName>. */
export function ministryLabel(ministry: string): string {
  const icon = ministryIcon(ministry);
  return icon ? `${icon} ${ministry}` : ministry;
}

/** "🎵 Music, 💻 Tech" */
export function ministryList(ministries: readonly string[]): string {
  return ministries.map(ministryLabel).join(", ");
}

export const MOBILE_NUMBER_PATTERN = String.raw`(09\d{9})|(\+639\d{9})|(639\d{9})`;
export const MOBILE_NUMBER_REGEX = /^(09\d{9}|\+639\d{9}|639\d{9})$/;
export const MOBILE_NUMBER_HELP = "Enter a valid mobile number: 09XXXXXXXXX, 639XXXXXXXXX, or +639XXXXXXXXX.";
