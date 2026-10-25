"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { SortDir } from "@/lib/sort";

/** Table header that toggles `?sort=<column>&dir=asc|desc` in the URL, keeping other params. */
export function SortableTh({
  column,
  label,
  sort,
  dir,
  align = "left",
}: {
  column: string;
  label: string;
  sort: string;
  dir: SortDir;
  align?: "left" | "right";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = sort === column;
  const nextDir: SortDir = active && dir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams(searchParams.toString());
  params.set("sort", column);
  params.set("dir", nextDir);

  return (
    <th
      className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : ""}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link
        href={`${pathname}?${params.toString()}`}
        replace
        scroll={false}
        className={`inline-flex items-center gap-1 hover:text-stm-brand transition ${active ? "text-stm-brand" : ""}`}
      >
        {label}
        <span aria-hidden className={`text-[10px] ${active ? "" : "opacity-30"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </th>
  );
}
