import { requireMemberManager } from "@/lib/access";
import { getVglOptions } from "@/lib/vgl";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { NewMemberForm } from "./NewMemberForm";

export default async function NewMemberPage() {
  const viewer = await requireMemberManager();
  const vglOptions = await getVglOptions();

  return (
    <div>
      <Breadcrumbs items={[{ label: "Members", href: "/members" }, { label: "Add STM" }]} />
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 mb-4">Add service team member</h1>
      <NewMemberForm vglOptions={vglOptions} serviceOptions={viewer.services} />
    </div>
  );
}
