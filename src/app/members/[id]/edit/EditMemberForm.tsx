"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import type { Member } from "@/db/schema";
import { MemberFields } from "@/components/MemberFields";
import { FormError, primaryBtnCls, secondaryBtnCls } from "@/components/form";
import { submitKeepingValues } from "@/components/submitKeepingValues";
import type { VglOption } from "@/lib/vgl";
import { deleteMember, updateMember } from "../../actions";

export function EditMemberForm({
  member,
  vglOptions,
  serviceOptions,
}: {
  member: Member;
  vglOptions: VglOption[];
  serviceOptions: readonly string[];
}) {
  const [state, action, pending] = useActionState(updateMember.bind(null, member.id), undefined);
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    const message =
      `Delete ${member.firstName} ${member.lastName}? This also deletes their check-in history.\n\n` +
      "To keep their attendance, untick Active instead.";
    if (!confirm(message)) return;
    startDelete(() => deleteMember(member.id));
  }

  return (
    <form onSubmit={submitKeepingValues(action)} className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 flex flex-col gap-6 max-w-3xl">
      <MemberFields vglOptions={vglOptions} serviceOptions={serviceOptions} defaultValues={member} showActive />
      <FormError message={state?.error} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm text-red-600 hover:underline disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete member"}
        </button>
        <div className="flex gap-2">
          <Link href="/members" className={secondaryBtnCls}>
            Cancel
          </Link>
          <button type="submit" disabled={pending} className={primaryBtnCls}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
