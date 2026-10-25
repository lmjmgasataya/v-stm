"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { inputCls } from "@/components/form";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-stm-navy">Service Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">Staff sign in</p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Username</span>
            <input name="username" autoComplete="username" autoFocus required className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Password</span>
            <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
          </label>

          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="bg-stm-navy hover:bg-stm-navy/90 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
