"use client";

import { useActionState, useState } from "react";
import { FormError, inputCls, primaryBtnCls } from "@/components/form";
import { submitKeepingValues } from "@/components/submitKeepingValues";
import { useToastOnResult } from "@/components/toast/useToastOnResult";
import { ACTIVITY_LIMITS, describeActivityRule, type ActivityRule } from "@/lib/activity-rule";
import { saveActivityRule } from "./actions";

export function ActivityRuleForm({ rule }: { rule: ActivityRule }) {
  const [state, dispatch, pending] = useActionState(saveActivityRule, undefined);
  useToastOnResult(state?.success ? state : undefined);
  const [enabled, setEnabled] = useState(rule.enabled);
  const [minServes, setMinServes] = useState(String(rule.minServes));
  const [withinDays, setWithinDays] = useState(String(rule.withinDays));
  const preview = describeActivityRule({ enabled, minServes: Number(minServes) || 1, withinDays: Number(withinDays) || 30 });

  return (
    <form onSubmit={submitKeepingValues(dispatch)} className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-stone-900">Who counts as active</h2>
        <p className="text-sm text-stone-500 mt-1">
          Used by the dashboard, the Members list&apos;s Active filter and Reports. Check-in is never affected — anyone on the
          roster can always be checked in.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-5 w-5 accent-stm-brand"
        />
        <span>
          <span className="block font-semibold text-stone-800">Use serving activity</span>
          <span className="block text-sm text-stone-500">
            Off: everyone on the roster counts as active. Turn on once check-in data has built up.
          </span>
        </span>
      </label>

      <fieldset disabled={!enabled} className="flex flex-wrap items-end gap-3 disabled:opacity-50">
        <legend className="sr-only">Activity rule</legend>
        <span className="pb-2.5 text-sm text-stone-700">Active if they served at least</span>
        <input
          type="number"
          name="minServes"
          aria-label="Times served"
          min={ACTIVITY_LIMITS.minServes.min}
          max={ACTIVITY_LIMITS.minServes.max}
          value={minServes}
          onChange={(e) => setMinServes(e.target.value)}
          className={`${inputCls.replace("w-full", "")} w-20`}
        />
        <span className="pb-2.5 text-sm text-stone-700">time(s) in the last</span>
        <input
          type="number"
          name="withinDays"
          aria-label="Days"
          min={ACTIVITY_LIMITS.withinDays.min}
          max={ACTIVITY_LIMITS.withinDays.max}
          value={withinDays}
          onChange={(e) => setWithinDays(e.target.value)}
          className={`${inputCls.replace("w-full", "")} w-24`}
        />
        <span className="pb-2.5 text-sm text-stone-700">days</span>
      </fieldset>
      {/* A disabled fieldset's inputs aren't posted — keep the numbers when saving with the rule off */}
      {!enabled && (
        <>
          <input type="hidden" name="minServes" value={minServes} />
          <input type="hidden" name="withinDays" value={withinDays} />
        </>
      )}
      <p className="text-xs text-stone-500 -mt-2">
        {enabled ? `${preview}. A day counts once even if they served two services.` : "Rule is off."}
      </p>

      <FormError message={state?.error} />
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={primaryBtnCls}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
