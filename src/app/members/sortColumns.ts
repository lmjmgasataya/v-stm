export const MEMBER_SORT_COLUMNS = [
  "lastName",
  "firstName",
  "mobileNumber",
  "serviceAttending",
  "vglName",
  "lifestage",
  "age",
] as const;

export type MemberSortColumn = (typeof MEMBER_SORT_COLUMNS)[number];
