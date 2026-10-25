import {
  DISCIPLESHIP_JOURNEY_STEPS,
  GENDER_OPTIONS,
  LIFESTAGE_OPTIONS,
  MINISTRY_OPTIONS,
  MOBILE_NUMBER_HELP,
  MOBILE_NUMBER_REGEX,
} from "@/lib/constants";

// Shared FormData parsing/validation for adding and editing a service team member.
// Edit here once — both forms post the same field names (see MemberFields).

export interface MemberInput {
  lastName: string;
  firstName: string;
  middleInitial: string;
  nickname: string;
  mobileNumber: string;
  facebookMessengerName: string;
  lifestage: string;
  age: number | null;
  /** Raw age text, so validation can tell "blank" from "not a number". */
  ageText: string;
  gender: string;
  serviceAttending: string;
  email: string;
  vglId: number | null;
  vglName: string;
  discipleshipJourneyCompleted: string[];
  ministries: string[];
  isActive: boolean;
}

export const MAX_NICKNAME_LENGTH = 40;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(formData: FormData, key: string): string {
  return ((formData.get(key) as string | null) ?? "").trim();
}

/** Keeps only known values, in the list's own order, without repeats. */
function pick(formData: FormData, key: string, allowed: readonly string[]): string[] {
  const chosen = new Set(formData.getAll(key).map(String));
  return allowed.filter((value) => chosen.has(value));
}

export function readMemberInput(formData: FormData): MemberInput {
  const ageText = str(formData, "age");
  const vglIdText = str(formData, "vglId");
  return {
    lastName: str(formData, "lastName"),
    firstName: str(formData, "firstName"),
    middleInitial: str(formData, "middleInitial").replace(/\./g, "").toUpperCase().slice(0, 3),
    nickname: str(formData, "nickname").slice(0, MAX_NICKNAME_LENGTH),
    mobileNumber: normalizeMobileNumber(str(formData, "mobileNumber")),
    facebookMessengerName: str(formData, "facebookMessengerName"),
    lifestage: str(formData, "lifestage"),
    age: /^\d+$/.test(ageText) ? Number(ageText) : null,
    ageText,
    gender: str(formData, "gender"),
    serviceAttending: str(formData, "serviceAttending"),
    email: str(formData, "email").toLowerCase(),
    vglId: /^\d+$/.test(vglIdText) ? Number(vglIdText) : null,
    vglName: str(formData, "vglName"),
    discipleshipJourneyCompleted: pick(formData, "discipleshipJourneyCompleted", DISCIPLESHIP_JOURNEY_STEPS),
    ministries: pick(formData, "ministries", MINISTRY_OPTIONS),
    // Only the edit form shows the toggle; adding always creates an active member
    isActive: formData.has("isActiveShown") ? formData.get("isActive") === "on" : true,
  };
}

/**
 * Strips spaces/dashes/parens so "0917 123 4567" and "0917-123-4567" dedupe together.
 * Restores the leading 0 spreadsheets drop (9171234567 → 09171234567).
 */
export function normalizeMobileNumber(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, "");
  return /^9\d{9}$/.test(digits) ? `0${digits}` : digits;
}

/** `services` = the services this user may assign (Viewer.services). */
export function validateMemberInput(input: MemberInput, services: readonly string[]): string | null {
  if (!input.lastName) return "Last name is required.";
  if (!input.firstName) return "First name is required.";
  if (input.mobileNumber && !MOBILE_NUMBER_REGEX.test(input.mobileNumber)) return MOBILE_NUMBER_HELP;
  if (input.ageText && (input.age === null || input.age < 1 || input.age > 120)) return "Enter a valid age.";
  if (!input.gender) return "Gender is required.";
  if (!(GENDER_OPTIONS as readonly string[]).includes(input.gender)) return "Select a valid gender.";
  if (input.lifestage && !(LIFESTAGE_OPTIONS as readonly string[]).includes(input.lifestage)) {
    return "Select a valid lifestage.";
  }
  if (!input.serviceAttending) return "Service attending is required.";
  if (!services.includes(input.serviceAttending)) return "Select one of your services.";
  if (input.email && !EMAIL_REGEX.test(input.email)) return "Enter a valid email address.";
  if (input.ministries.length === 0) return "Select at least one ministry.";
  return null;
}

/** Column values for insert/update. `vglName` should already be resolved (see resolveVgl). */
export function toMemberValues(input: MemberInput) {
  return {
    lastName: input.lastName,
    firstName: input.firstName,
    middleInitial: input.middleInitial,
    nickname: input.nickname || null,
    mobileNumber: input.mobileNumber,
    facebookMessengerName: input.facebookMessengerName || null,
    lifestage: input.lifestage || null,
    age: input.age,
    gender: input.gender,
    serviceAttending: input.serviceAttending,
    email: input.email || null,
    vglId: input.vglId,
    vglName: input.vglName || null,
    discipleshipJourneyCompleted: input.discipleshipJourneyCompleted.join(",") || null,
    ministries: input.ministries,
    isActive: input.isActive,
  };
}

/** "Dela Cruz, Juan P. (Jun)" */
export function memberDisplayName(m: {
  lastName: string;
  firstName: string;
  middleInitial: string;
  nickname?: string | null;
}): string {
  return `${m.lastName}, ${m.firstName}${m.middleInitial ? ` ${m.middleInitial}.` : ""}${m.nickname ? ` (${m.nickname})` : ""}`;
}
