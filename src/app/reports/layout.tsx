import { requireViewer } from "@/lib/access";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Sunday Reports</h1>
      {children}
    </div>
  );
}
