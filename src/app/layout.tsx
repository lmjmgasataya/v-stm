import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { getViewer } from "@/lib/access";
import { logout } from "@/app/login/actions";
import { BottomNav, SidebarNav } from "@/components/AppNav";
import { BrandMark, SignOutIcon } from "@/components/icons";
import { NavigationProgress } from "@/components/NavigationProgress";
import { Toaster } from "@/components/toast/Toaster";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Service Team",
  description: "Service team member database and check-in",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const initials = viewer?.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <html lang="en" className={`h-full ${jakarta.variable}`}>
      <body className="min-h-full font-sans antialiased text-stone-800">
        <Toaster>
          <NavigationProgress />
          {viewer ? (
            <div className="lg:pl-64">
              {/* Desktop: fixed teal sidebar */}
              <aside className="hidden lg:flex print:hidden fixed inset-y-0 left-0 z-30 w-64 flex-col bg-stm-brand-dark bg-[radial-gradient(120%_60%_at_0%_0%,rgba(242,107,79,0.18),transparent_60%)] px-4 py-6">
                <Link href="/" className="flex items-center gap-3 px-2 mb-8">
                  <BrandMark className="h-10 w-10 text-stm-brand" />
                  <span className="leading-tight">
                    <span className="block text-base font-extrabold tracking-tight text-white">Service Team</span>
                    <span className="block text-xs font-medium text-teal-100/60">Check-in &amp; roster</span>
                  </span>
                </Link>
                <SidebarNav isSuperAdmin={viewer.isSuperAdmin} />
                <div className="mt-auto rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stm-accent text-sm font-bold text-white">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{viewer.name}</p>
                      <p className="truncate text-xs text-teal-100/70">
                        {viewer.serviceGroup ?? "All services"} · <span className="capitalize">{viewer.role}</span>
                      </p>
                    </div>
                  </div>
                  <form action={logout} className="mt-3">
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-teal-50/80 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white"
                    >
                      <SignOutIcon className="h-4 w-4" />
                      Sign out
                    </button>
                  </form>
                </div>
              </aside>

              {/* Phones/tablets: slim top bar (navigation lives in the bottom tab bar) */}
              <header className="lg:hidden print:hidden sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-stone-200/80 bg-white/90 px-4 py-2.5 backdrop-blur">
                <Link href="/" className="flex items-center gap-2.5">
                  <BrandMark className="h-8 w-8 text-stm-brand" />
                  <span className="text-sm font-extrabold tracking-tight text-stone-900">Service Team</span>
                </Link>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-stm-brand/10 px-2.5 py-1 text-xs font-semibold text-stm-brand">
                    {viewer.serviceGroup ?? "All services"}
                  </span>
                  <form action={logout}>
                    <button
                      type="submit"
                      aria-label="Sign out"
                      title="Sign out"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                    >
                      <SignOutIcon className="h-4.5 w-4.5" />
                    </button>
                  </form>
                </div>
              </header>

              <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:py-10">{children}</main>
              <BottomNav isSuperAdmin={viewer.isSuperAdmin} />
            </div>
          ) : (
            <main>{children}</main>
          )}
        </Toaster>
      </body>
    </html>
  );
}
