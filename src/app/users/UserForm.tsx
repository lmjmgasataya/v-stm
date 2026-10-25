"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import type { User } from "@/db/schema";
import { Field, FormError, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/form";
import { submitKeepingValues } from "@/components/submitKeepingValues";
import { SERVICE_GROUPS, SERVICE_GROUP_NAMES } from "@/lib/constants";
import { createUser, deleteUser, updateUser, type UserFormState } from "./actions";

/** Add (no `user`) or edit a staff user. */
export function UserForm({ user, isSelf = false }: { user?: User; isSelf?: boolean }) {
  const action = user ? updateUser.bind(null, user.id) : createUser;
  const [state, dispatch, pending] = useActionState<UserFormState, FormData>(action, undefined);
  const [deleting, startDelete] = useTransition();

  return (
    <form onSubmit={submitKeepingValues(dispatch)} className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 flex flex-col gap-4 max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" required defaultValue={user?.name} placeholder="e.g. 2PM & 4PM Team" />
        <Field label="Username" name="username" required defaultValue={user?.username} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="serviceGroup" className="block text-sm font-medium text-stone-700 mb-1">
            Service group
          </label>
          <select id="serviceGroup" name="serviceGroup" defaultValue={user?.serviceGroup ?? ""} disabled={isSelf} className={inputCls}>
            <option value="">All services</option>
            {SERVICE_GROUP_NAMES.map((g) => (
              <option key={g} value={g}>
                {g} ({SERVICE_GROUPS[g].map((s) => s.split(" - ")[1]).filter((p, i, a) => a.indexOf(p) === i).join(", ")})
              </option>
            ))}
          </select>
          {/* A disabled select isn't posted — send the unchanged value for your own account */}
          {isSelf && <input type="hidden" name="serviceGroup" value={user?.serviceGroup ?? ""} />}
          <p className="text-xs text-stone-400 mt-1">Only sees members, check-ins and attendance for these services.</p>
        </div>
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-stone-700 mb-1">
            Role
          </label>
          <select id="role" name="role" defaultValue={user?.role ?? "volunteer"} disabled={isSelf} className={inputCls}>
            <option value="volunteer">Volunteer — check-in only</option>
            <option value="admin">Admin — can also add, edit and import members</option>
          </select>
          {isSelf && <input type="hidden" name="role" value={user?.role} />}
          <p className="text-xs text-stone-400 mt-1">An admin with All services also manages users.</p>
        </div>
      </div>

      <Field
        label={user ? "New password" : "Password"}
        name="password"
        type="password"
        required={!user}
        minLength={8}
        autoComplete="new-password"
        hint={user ? "Leave blank to keep the current password." : "At least 8 characters."}
      />

      <FormError message={state?.error} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {user && !isSelf ? (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (confirm(`Delete ${user.name} (${user.username})? They won't be able to sign in.`)) {
                startDelete(() => deleteUser(user.id));
              }
            }}
            className="text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete user"}
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Link href="/users" className={secondaryBtnCls}>
            Cancel
          </Link>
          <button type="submit" disabled={pending} className={primaryBtnCls}>
            {pending ? "Saving…" : user ? "Save changes" : "Add user"}
          </button>
        </div>
      </div>
    </form>
  );
}
