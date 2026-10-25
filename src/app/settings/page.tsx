import { requireSuperAdmin } from "@/lib/access";
import { getActivityRule } from "@/lib/settings";
import { ActivityRuleForm } from "./ActivityRuleForm";

export default async function SettingsPage() {
  await requireSuperAdmin();
  const rule = await getActivityRule();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Settings</h1>
        <p className="text-sm text-stone-500">Apply to every user and service.</p>
      </div>
      <ActivityRuleForm rule={rule} />
    </div>
  );
}
