"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast/ToastContext";
import { approveMember } from "./actions";

/** Approves an STM a volunteer added at check-in (pending → active). */
export function ApproveButton({ memberId, name }: { memberId: number; name: string }) {
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { ok } = await approveMember(memberId);
          showToast(ok ? "success" : "warning", ok ? `${name} approved.` : `${name} is no longer pending.`);
          router.refresh();
        })
      }
      className="rounded-full bg-stm-green px-3 py-1 text-xs font-semibold text-white transition hover:bg-stm-green/90 disabled:opacity-50"
    >
      {pending ? "Approving…" : "Approve"}
    </button>
  );
}
