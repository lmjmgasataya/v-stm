"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  AttendanceIcon,
  CheckInIcon,
  EventsIcon,
  HomeIcon,
  LeadersIcon,
  MembersIcon,
  MoreIcon,
  ReportsIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";

interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the phone tab bar */
  tabLabel?: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  /** Items sharing a group sit together under its heading in the sidebar */
  group?: string;
  superAdminOnly?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/check-in", label: "Sunday Check-in", tabLabel: "Check-in", Icon: CheckInIcon, group: "Sunday services" },
  { href: "/attendance", label: "Sunday Attendance", Icon: AttendanceIcon, group: "Sunday services" },
  { href: "/reports", label: "Sunday Reports", Icon: ReportsIcon, group: "Sunday services" },
  { href: "/members", label: "Service Team Members", tabLabel: "Members", Icon: MembersIcon, group: "People" },
  { href: "/leaders", label: "Leaders & Staff", Icon: LeadersIcon, group: "People" },
  { href: "/events", label: "All Events", tabLabel: "Events", Icon: EventsIcon, group: "Events" },
  { href: "/event-attendance", label: "Event Attendance", Icon: AttendanceIcon, group: "Events" },
  { href: "/users", label: "Users", Icon: UsersIcon, superAdminOnly: true, group: "Admin" },
  { href: "/settings", label: "Settings", Icon: SettingsIcon, superAdminOnly: true, group: "Admin" },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
}

/** Desktop sidebar links. */
export function SidebarNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const isActive = useIsActive();
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {ITEMS.filter((i) => !i.superAdminOnly || isSuperAdmin).map(({ href, label, Icon, group }, index, items) => {
        const active = isActive(href);
        // Group heading before the first item of a group, a little gap after its last
        const startsGroup = group && items[index - 1]?.group !== group;
        const endsGroup = group && items[index + 1]?.group !== group;
        return (
          // A group right after another group already has the previous group's bottom gap
          <div key={href} className={`${startsGroup && index > 0 && !items[index - 1].group ? "mt-3" : ""} ${endsGroup ? "mb-3" : ""}`}>
            {startsGroup && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-teal-100/50">{group}</p>
            )}
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active ? "bg-white text-stm-brand-dark shadow-sm" : "text-teal-50/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-stm-brand" : "text-teal-100/60 group-hover:text-white"}`} />
              {label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

// The phone tab bar fits five tabs; everything after these lives under "More"
const PRIMARY_TABS = ["/", "/check-in", "/members", "/events"];

/** Phone bottom tab bar — thumb-reachable at the check-in table. */
export function BottomNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const isActive = useIsActive();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = ITEMS.filter((i) => !i.superAdminOnly || isSuperAdmin);
  const tabs = items.filter((i) => PRIMARY_TABS.includes(i.href));
  const more = items.filter((i) => !PRIMARY_TABS.includes(i.href));
  const moreActive = more.some((i) => isActive(i.href));

  const tabCls = (active: boolean) =>
    `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition ${active ? "text-stm-brand" : "text-stone-500"}`;
  const pillCls = (active: boolean) =>
    `flex h-8 w-12 items-center justify-center rounded-full transition ${active ? "bg-stm-brand/10" : ""}`;

  return (
    <>
      {moreOpen && (
        // Tap outside to close
        <div className="lg:hidden fixed inset-0 z-30 bg-stone-900/20" onClick={() => setMoreOpen(false)} aria-hidden="true" />
      )}
      <nav
        aria-label="Main"
        className="lg:hidden print:hidden fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        {moreOpen && (
          <div id="more-menu" className="absolute bottom-full right-3 mb-2 w-52 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl">
            {more.map(({ href, label, Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    active ? "bg-stm-brand/10 text-stm-brand" : "text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-5">
          {tabs.map(({ href, label, tabLabel, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                aria-current={active ? "page" : undefined}
                className={tabCls(active)}
              >
                <span className={pillCls(active)}>
                  <Icon className="h-5 w-5" />
                </span>
                {tabLabel ?? label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls="more-menu"
            className={tabCls(moreActive || moreOpen)}
          >
            <span className={pillCls(moreActive || moreOpen)}>
              <MoreIcon className="h-5 w-5" />
            </span>
            More
          </button>
        </div>
      </nav>
    </>
  );
}
