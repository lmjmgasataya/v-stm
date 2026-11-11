"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast/ToastContext";
import { setProfileSubmitted } from "./actions";

/** "Submitted the Service Team Members Profile?" — ticked/unticked right in the members list (admins). */
export function ProfileCheckbox({ memberId, name, value }: { memberId: number; name: string; value: boolean }) {
  const [checked, setChecked] = useState(value);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function toggle(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      const result = await setProfileSubmitted(memberId, next);
      if (!result.ok) {
        setChecked(!next);
        showToast("warning", `Couldn't update ${name}'s profile status.`);
      }
    });
  }

  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer ${pending ? "opacity-60" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => toggle(e.target.checked)}
        aria-label={`${name}: submitted the Service Team Members Profile`}
        className="h-4 w-4 accent-stm-green"
      />
      <span className={`text-xs font-medium ${checked ? "text-stm-green" : "text-stm-amber"}`}>{checked ? "Submitted" : "Not yet"}</span>
    </label>
  );
}
