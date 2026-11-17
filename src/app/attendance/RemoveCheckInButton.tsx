"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toast/ToastContext";
import { removeCheckIn } from "./actions";

/** Remove one service check-in from Sunday Attendance (after a confirm). */
export function RemoveCheckInButton({ memberId, date, service, name }: { memberId: number; date: string; service: string; name: string }) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Remove ${service} check-in for ${name}`}
      title="Remove check-in"
      onClick={() => {
        if (!confirm(`Remove ${name}'s ${service} check-in?`)) return;
        startTransition(async () => {
          const result = await removeCheckIn(memberId, date, service);
          showToast(result.ok ? "success" : "warning", result.ok ? `${result.message} (${name}, ${service})` : result.error);
        });
      }}
      className="rounded-full px-2 py-0.5 text-lg leading-none text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
    >
      ×
    </button>
  );
}
