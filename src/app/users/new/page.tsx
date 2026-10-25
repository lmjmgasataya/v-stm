import { requireSuperAdmin } from "@/lib/access";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { UserForm } from "../UserForm";

export default async function NewUserPage() {
  await requireSuperAdmin();
  return (
    <div>
      <Breadcrumbs items={[{ label: "Users", href: "/users" }, { label: "Add user" }]} />
      <h1 className="text-2xl font-bold text-stm-navy mb-4">Add user</h1>
      <UserForm />
    </div>
  );
}
