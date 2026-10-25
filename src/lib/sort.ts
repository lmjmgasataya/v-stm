// Shared by server pages (parsing ?sort=&dir=) and the client SortableTh header.

export type SortDir = "asc" | "desc";

export function parseSort<T extends string>(
  sortParam: string | undefined,
  dirParam: string | undefined,
  columns: readonly T[],
  fallback: T
): { sort: T; dir: SortDir } {
  const sort = columns.includes(sortParam as T) ? (sortParam as T) : fallback;
  const dir: SortDir = dirParam === "desc" ? "desc" : "asc";
  return { sort, dir };
}
