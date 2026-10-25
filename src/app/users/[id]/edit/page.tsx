import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/access";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { UserForm } from "../../UserForm";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireSuperAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) notFound();

  return (
    <div>
      <Breadcrumbs items={[{ label: "Users", href: "/users" }, { label: user.name }]} />
      <h1 className="text-2xl font-bold text-stm-navy mb-4">Edit {user.name}</h1>
      <UserForm user={user} isSelf={user.id === viewer.userId} />
    </div>
  );
}
