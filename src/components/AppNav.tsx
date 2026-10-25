"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AttendanceIcon, CheckInIcon, EventsIcon, HomeIcon, MembersIcon, UsersIcon } from "@/components/icons";

const ITEMS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/check-in", label: "Check-in", Icon: CheckInIcon },
  { href: "/members", label: "Members", Icon: MembersIcon },
  { href: "/events", label: "Events", Icon: EventsIcon },
  { href: "/attendance", label: "Attendance", Icon: AttendanceIcon },
  { href: "/users", label: "Users", Icon: UsersIcon, superAdminOnly: true },
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
      {ITEMS.filter((i) => !i.superAdminOnly || isSuperAdmin).map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active ? "bg-white text-stm-brand-dark shadow-sm" : "text-teal-50/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "text-stm-brand" : "text-teal-100/60 group-hover:text-white"}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone bottom tab bar — thumb-reachable at the check-in table. */
export function BottomNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const isActive = useIsActive();
  const items = ITEMS.filter((i) => !i.superAdminOnly || isSuperAdmin);
  return (
    <nav
      aria-label="Main"
      className="lg:hidden print:hidden fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition ${
                active ? "text-stm-brand" : "text-stone-500"
              }`}
            >
              <span className={`flex h-8 w-12 items-center justify-center rounded-full transition ${active ? "bg-stm-brand/10" : ""}`}>
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
