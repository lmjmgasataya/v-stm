import { requireViewer } from "@/lib/access";
import { InsightsTabs } from "./InsightsTabs";

export default async function InsightsLayout({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Insights</h1>
        <InsightsTabs />
      </div>
      {children}
    </div>
  );
}
