"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Event sub-menu: tabs split by thin separators over a bottom border; unselected tabs are white buttons, the selected one light teal. Pre-registration and Edit are admin-only, and Pre-registration only shows when the event uses it. */
export function EventTabs({ eventId, canManage, preRegistration }: { eventId: number; canManage: boolean; preRegistration: boolean }) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;
  const tabs = [
    { href: base, label: "Check-in" },
    { href: `${base}/summary`, label: "Summary" },
    ...(canManage
      ? [
          ...(preRegistration ? [{ href: `${base}/registrations`, label: "Pre-registration" }] : []),
          { href: `${base}/edit`, label: "Edit event" },
        ]
      : []),
  ];
  return (
    // Wraps instead of scrolling, so there's never a scrollbar under the tabs
    <nav aria-label="Event" className="flex flex-wrap items-center gap-y-1 border-b border-stone-200 pb-2">
      {tabs.map(({ href, label }, i) => {
        const active = pathname === href;
        return (
          <Fragment key={href}>
            {i > 0 && <span className="mx-1.5 h-5 w-px bg-stone-300" aria-hidden="true" />}
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-stm-brand/10 text-stm-brand ring-1 ring-stm-brand/25"
                  : "bg-white text-stone-700 shadow-sm ring-1 ring-stone-200 hover:ring-stm-brand/40 hover:text-stm-brand"
              }`}
            >
              {label}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
