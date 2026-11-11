export const MEMBER_SORT_COLUMNS = [
  "lastName",
  "firstName",
  "mobileNumber",
  "serviceAttending",
  "lifestage",
] as const;

export type MemberSortColumn = (typeof MEMBER_SORT_COLUMNS)[number];
