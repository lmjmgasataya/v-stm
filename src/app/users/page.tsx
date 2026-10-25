import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/access";
import { formatDate } from "@/lib/date";
import { primaryBtnCls } from "@/components/form";

export default async function UsersPage() {
  const viewer = await requireSuperAdmin();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      serviceGroup: users.serviceGroup,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.serviceGroup), asc(users.name));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stm-navy">Users</h1>
        <Link href="/users/new" className={primaryBtnCls}>
          + Add user
        </Link>
      </div>
      <p className="text-sm text-gray-500">
        A user tied to a service group only sees that group&apos;s members, check-ins and attendance. Changes apply on their
        next page load.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Service group</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                  {u.name}
                  {u.id === viewer.userId && <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-600">{u.username}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="rounded-full bg-stm-navy/10 px-2 py-0.5 text-xs font-semibold text-stm-navy">
                    {u.serviceGroup ?? "All services"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-600 capitalize">{u.role}</td>
                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/users/${u.id}/edit`} className="text-stm-navy hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
