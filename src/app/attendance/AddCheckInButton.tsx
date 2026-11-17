"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { FormError, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/form";
import { matchesMember } from "@/components/checkInParts";
import { useToast } from "@/components/toast/ToastContext";
import { SERVICE_GROUPS, groupOfAttending } from "@/lib/constants";
import { memberDisplayName } from "@/lib/members";
import { addManualCheckIn, getManualCheckInMembers, type ManualCheckInMember } from "./actions";

const MAX_RESULTS = 20;

/**
 * Record a check-in that was missed on the day. The date defaults to the one on the page but
 * can be any day up to today — also how a Sunday with no check-ins at all gets its first one.
 */
export function AddCheckInButton({
  date,
  today,
  services,
  defaultService,
}: {
  /** Pre-filled date (the page's selected date). */
  date: string;
  today: string;
  /** The viewer's services. */
  services: readonly string[];
  /** The page's service filter, if any — pre-ticked. */
  defaultService: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={secondaryBtnCls}>
        + Add check-in
      </button>
      {open && <AddCheckInModal date={date} today={today} services={services} defaultService={defaultService} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddCheckInModal({
  date: pageDate,
  today,
  services,
  defaultService,
  onClose,
}: {
  date: string;
  today: string;
  services: readonly string[];
  defaultService: string;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [date, setDate] = useState(pageDate);
  const [roster, setRoster] = useState<ManualCheckInMember[] | null>(null);
  const [query, setQuery] = useState("");
  const [member, setMember] = useState<ManualCheckInMember | null>(null);
  const [ticked, setTicked] = useState<string[]>(defaultService ? [defaultService] : services.length === 1 ? [...services] : []);
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getManualCheckInMembers().then((rows) => !cancelled && setRoster(rows));
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!roster || tokens.length === 0) return [];
    return roster.filter((m) => matchesMember(m, tokens)).slice(0, MAX_RESULTS);
  }, [roster, query]);

  function pick(m: ManualCheckInMember) {
    setMember(m);
    setError(undefined);
    // No service filter on the page: tick the member's own services (those this user can see)
    if (!defaultService) {
      const group = groupOfAttending(m.serviceAttending);
      const own = group ? services.filter((s) => (SERVICE_GROUPS[group] as readonly string[]).includes(s)) : [];
      if (own.length) setTicked(own);
    }
  }

  function toggle(service: string) {
    setTicked((prev) => (prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]));
  }

  function save() {
    if (!date || date > today) return setError("Pick a date up to today.");
    if (!member) return setError("Pick a member.");
    if (ticked.length === 0) return setError("Select at least one service.");
    setError(undefined);
    startSaving(async () => {
      const result = await addManualCheckIn(member.id, date, ticked);
      if (!result.ok) return setError(result.error);
      showToast("success", result.message);
      onClose();
      // Show the day it was added to (keeping the page's filters)
      if (date !== pageDate) {
        const params = new URLSearchParams(window.location.search);
        params.delete("month");
        params.set("date", date);
        router.push(`/attendance?${params.toString()}`, { scroll: false });
      }
    });
  }

  return (
    <Modal title="Add check-in" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-stone-500">For someone who served but wasn&apos;t checked in on the day.</p>

        <div>
          <label htmlFor="add-check-in-date" className="block text-sm font-medium text-stone-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            id="add-check-in-date"
            type="date"
            required
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </div>

        {member ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-stm-brand/40 bg-stm-brand/5 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="font-medium text-stone-900 truncate">{memberDisplayName(member)}</p>
              <p className="text-xs text-stone-500 truncate">{[member.ministries.join(", "), member.serviceAttending].filter(Boolean).join(" · ")}</p>
            </div>
            <button type="button" onClick={() => setMember(null)} className="text-sm font-semibold text-stm-brand hover:underline">
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="add-check-in-search" className="text-sm font-medium text-stone-700">
              Member <span className="text-red-500">*</span>
            </label>
            <input
              id="add-check-in-search"
              type="search"
              autoFocus
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={roster ? "Search name, nickname, mobile, VGL…" : "Loading members…"}
              disabled={!roster}
              className={inputCls}
            />
            {query.trim() && roster && (
              <ul className="max-h-64 overflow-y-auto divide-y divide-stone-100 rounded-xl border border-stone-200">
                {matches.length === 0 ? (
                  <li className="px-3.5 py-2.5 text-sm text-stone-400">No members match.</li>
                ) : (
                  matches.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => pick(m)} className="w-full px-3.5 py-2 text-left hover:bg-stone-50">
                        <span className="text-sm font-medium text-stone-900">{memberDisplayName(m)}</span>
                        {m.status !== "active" && (
                          <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-500 align-middle">
                            {m.status === "pending" ? "Pending" : "Inactive"}
                          </span>
                        )}
                        <span className="block text-xs text-stone-500">{[m.ministries.join(", "), m.serviceAttending].filter(Boolean).join(" · ")}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}

        <fieldset>
          <legend className="text-sm font-medium text-stone-700 mb-2">
            Service <span className="text-red-500">*</span>
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {services.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={ticked.includes(s)} onChange={() => toggle(s)} className="size-4 accent-stm-brand" />
                {s}
              </label>
            ))}
          </div>
        </fieldset>

        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnCls}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !member} className={primaryBtnCls}>
            {saving ? "Saving…" : "Add check-in"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
