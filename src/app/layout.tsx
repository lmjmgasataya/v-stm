import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { getViewer } from "@/lib/access";
import { logout } from "@/app/login/actions";
import { NavigationProgress } from "@/components/NavigationProgress";
import { Toaster } from "@/components/toast/Toaster";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Service Team",
  description: "Service team member database and check-in",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <html lang="en" className="h-full">
      <body className={`${geist.className} min-h-full antialiased text-gray-800`}>
        <Toaster>
          <NavigationProgress />
          {viewer && (
            <header className="print:hidden bg-white border-b border-gray-200 sticky top-0 z-10">
              <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <Link href="/" className="text-lg font-bold text-stm-navy hover:opacity-80 transition">
                    Service Team
                  </Link>
                  <nav className="flex items-center gap-4 text-sm">
                    <Link href="/members" className="text-gray-500 hover:text-stm-navy transition">
                      Members
                    </Link>
                    <Link href="/check-in" className="text-gray-500 hover:text-stm-navy transition">
                      Check-in
                    </Link>
                    <Link href="/attendance" className="text-gray-500 hover:text-stm-navy transition">
                      Attendance
                    </Link>
                    {viewer.isSuperAdmin && (
                      <Link href="/users" className="text-gray-500 hover:text-stm-navy transition">
                        Users
                      </Link>
                    )}
                  </nav>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">
                    {viewer.name}
                    <span className="ml-1.5 rounded-full bg-stm-navy/10 px-2 py-0.5 font-semibold text-stm-navy">
                      {viewer.serviceGroup ?? "All services"}
                    </span>
                  </span>
                  <form action={logout}>
                    <button
                      type="submit"
                      className="text-xs text-gray-400 hover:text-stm-navy underline underline-offset-2 transition"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </header>
          )}
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </Toaster>
      </body>
    </html>
  );
}
