"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { MemberFields } from "@/components/MemberFields";
import { FormError, primaryBtnCls, secondaryBtnCls } from "@/components/form";
import { submitKeepingValues } from "@/components/submitKeepingValues";
import { useToastOnResult } from "@/components/toast/useToastOnResult";
import type { VglOption } from "@/lib/vgl";
import { createMember } from "../actions";

export function NewMemberForm({ vglOptions, serviceOptions }: { vglOptions: VglOption[]; serviceOptions: readonly string[] }) {
  const [state, action, pending] = useActionState(createMember, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useToastOnResult(state?.success ? state : undefined);

  // "Save & add another" returns success instead of redirecting — clear the form for the next one
  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state]);

  return (
    <form ref={formRef} onSubmit={submitKeepingValues(action)} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-6 max-w-3xl">
      <MemberFields vglOptions={vglOptions} serviceOptions={serviceOptions} />
      <FormError message={state?.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Link href="/members" className={secondaryBtnCls}>
          Cancel
        </Link>
        <button type="submit" name="intent" value="another" disabled={pending} className={secondaryBtnCls}>
          Save &amp; add another
        </button>
        <button type="submit" disabled={pending} className={primaryBtnCls}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
