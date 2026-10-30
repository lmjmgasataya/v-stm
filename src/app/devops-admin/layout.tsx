import { requireSuperAdmin } from "@/lib/access";
import { DevopsTabs } from "./DevopsTabs";

// Layouts don't re-render on client navigation, so each page also calls requireSuperAdmin().
export default async function DevopsAdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">DevOps</h1>
          <p className="text-sm text-stone-500">Super admins only. Read-only view of this app&apos;s database tables.</p>
        </div>
        <DevopsTabs />
      </div>
      {children}
    </div>
  );
}
