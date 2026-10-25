import { requireSuperAdmin } from "@/lib/access";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { UserForm } from "../UserForm";

export default async function NewUserPage() {
  await requireSuperAdmin();
  return (
    <div>
      <Breadcrumbs items={[{ label: "Users", href: "/users" }, { label: "Add user" }]} />
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 mb-4">Add user</h1>
      <UserForm />
    </div>
  );
}
