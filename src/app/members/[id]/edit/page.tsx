import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { memberScope, requireMemberManager } from "@/lib/access";
import { memberDisplayName } from "@/lib/members";
import { getVglOptions } from "@/lib/vgl";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EditMemberForm } from "./EditMemberForm";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMemberManager();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [[member], vglOptions] = await Promise.all([
    // Members outside a service-group admin's services are treated as not found
    db.select().from(members).where(and(eq(members.id, id), memberScope(viewer))).limit(1),
    getVglOptions(),
  ]);
  if (!member) notFound();

  return (
    <div>
      <Breadcrumbs items={[{ label: "Members", href: "/members" }, { label: memberDisplayName(member) }]} />
      <h1 className="text-2xl font-bold text-stm-navy mb-4">Edit {memberDisplayName(member)}</h1>
      <EditMemberForm member={member} vglOptions={vglOptions} serviceOptions={viewer.services} />
    </div>
  );
}
