import { requireViewer } from "@/lib/access";
import { ReportTabs } from "./ReportTabs";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Reports</h1>
        <ReportTabs />
      </div>
      {children}
    </div>
  );
}
