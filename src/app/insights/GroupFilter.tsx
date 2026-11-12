import Link from "next/link";
import type { ServiceGroup } from "@/lib/constants";

/** Service-group chips (All + each group) for users with no group of their own. Renders nothing for group users. */
export function GroupFilter({ basePath, groups, group }: { basePath: string; groups: ServiceGroup[]; group: ServiceGroup | null }) {
  if (!groups.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Service group">
      {[null, ...groups].map((g) => {
        const active = g === group;
        return (
          <Link
            key={g ?? "all"}
            href={g ? `${basePath}?group=${encodeURIComponent(g)}` : basePath}
            replace
            scroll={false}
            aria-current={active || undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              active
                ? "bg-stm-brand text-white shadow-sm"
                : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stm-brand/40 hover:text-stm-brand"
            }`}
          >
            {g ?? "All"}
          </Link>
        );
      })}
    </div>
  );
}
