"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/devops-admin", label: "Overview" },
  { href: "/devops-admin/data", label: "Data" },
];

/** DevOps sub-menu: underline tabs, same as ReportTabs. */
export function DevopsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="DevOps" className="flex gap-6 border-b border-stone-200">
      {TABS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold transition ${
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
