"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/insights", label: "Demographics" },
  { href: "/insights/engagement", label: "Engagement" },
  { href: "/insights/ministries", label: "Ministry health" },
];

/** Insights sub-menu: underline tabs, scrolling sideways on narrow phones. */
export function InsightsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Insights" className="flex gap-6 overflow-x-auto border-b border-stone-200">
      {TABS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-semibold whitespace-nowrap transition ${
              active ? "border-stm-brand text-stm-brand" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
