"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { inputCls, primaryBtnCls } from "@/components/form";
import { BrandMark } from "@/components/icons";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-stm-brand-dark lg:flex lg:flex-col lg:justify-between p-12 text-white">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-stm-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-stm-brand/60 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <BrandMark className="h-11 w-11 text-stm-brand" />
          <span className="text-lg font-extrabold tracking-tight">Service Team</span>
        </div>
        <div className="relative max-w-md">
          <p className="text-4xl font-extrabold leading-tight tracking-tight">
            Every hand that serves, <span className="text-stm-accent">counted</span> and cared for.
          </p>
          <p className="mt-4 text-teal-100/75">
            Keep your service team roster, check people in for each service and event, and see who showed up.
          </p>
        </div>
        <p className="relative text-xs text-teal-100/50">Victory Iloilo · Service Team</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="h-10 w-10 text-stm-brand" />
            <span className="text-lg font-extrabold tracking-tight text-stone-900">Service Team</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">Welcome back</h1>
          <p className="mt-1 text-sm text-stone-500">Sign in with your staff account.</p>

          <form action={action} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-700">Username</span>
              <input name="username" autoComplete="username" autoFocus required className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-700">Password</span>
              <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
            </label>

            {state?.error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
            )}

            <button type="submit" disabled={pending} className={`${primaryBtnCls} mt-2 w-full py-3`}>
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
