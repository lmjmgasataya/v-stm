"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/toast/ToastContext";
import { inputCls } from "@/components/form";
import { Chip, matchesMember } from "@/components/checkInParts";
import { MinistryName } from "@/components/MinistryName";
import { MINISTRY_OPTIONS, ministryLabel, ministryList } from "@/lib/constants";
import { formatTime } from "@/lib/date";
import { memberDisplayName } from "@/lib/members";
import type { RosterMember } from "@/app/check-in/CheckInWorkspace";
import { checkInToEvent, undoEventCheckIn } from "../actions";

interface EventCheckIn {
  memberId: number;
  checkedInAt: string;
}

type OptimisticUpdate = { type: "add"; checkIn: EventCheckIn } | { type: "remove"; memberId: number };

// Pull in check-ins made from other devices
const REFRESH_INTERVAL_MS = 20_000;

/**
 * Check-in for a custom event: any member (within the viewer's services), no service times.
 * Like the service check-in, the roster is preloaded for instant search but the not-yet
 * list stays hidden until someone searches or picks a ministry.
 */
export function EventCheckInWorkspace({
  eventId,
  scopeLabel,
  roster,
  checkIns,
}: {
  eventId: number;
  /** The viewer's service group, if any — only their members are listed. */
  scopeLabel: string | null;
  roster: RosterMember[];
  checkIns: EventCheckIn[];
}) {
  const [ministry, setMinistry] = useState("");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(checkIns, (rows, update: OptimisticUpdate) =>
    update.type === "add" ? [...rows, update.checkIn] : rows.filter((c) => c.memberId !== update.memberId)
  );
  const { showToast } = useToast();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  const checkedInAt = useMemo(() => new Map(optimistic.map((c) => [c.memberId, c.checkedInAt])), [optimistic]);

  const searching = query.trim() !== "";
  const browsing = searching || ministry !== "";
  const visible = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return roster.filter((m) => (!ministry || m.ministries.includes(ministry)) && (!tokens.length || matchesMember(m, tokens)));
  }, [roster, query, ministry]);

  const notYet = visible.filter((m) => !checkedInAt.has(m.id));
  const done = visible
    .filter((m) => checkedInAt.has(m.id))
    .sort((a, b) => checkedInAt.get(b.id)!.localeCompare(checkedInAt.get(a.id)!)); // latest first
  const remaining = roster.filter((m) => (!ministry || m.ministries.includes(ministry)) && !checkedInAt.has(m.id)).length;

  function handleCheckIn(member: RosterMember) {
    startTransition(async () => {
      applyOptimistic({ type: "add", checkIn: { memberId: member.id, checkedInAt: new Date().toISOString() } });
      const result = await checkInToEvent(eventId, member.id);
      if (result.ok) {
        showToast("success", `${member.firstName} ${member.lastName} checked in.`);
        // Back to a clean slate for the next person: no search, All ministries
        setQuery("");
        setMinistry("");
        searchRef.current?.focus();
      } else {
        showToast("warning", `${member.firstName} ${member.lastName}: ${result.error}`);
      }
    });
  }

  function handleUndo(member: RosterMember) {
    if (!confirm(`Undo check-in for ${member.firstName} ${member.lastName}?`)) return;
    startTransition(async () => {
      applyOptimistic({ type: "remove", memberId: member.id });
      await undoEventCheckIn(eventId, member.id);
      showToast("success", `Check-in undone for ${member.firstName} ${member.lastName}.`);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter checks in the only matching member — fast path for a busy line
    if (e.key !== "Enter" || !searching) return;
    if (visible.length === 1 && notYet.length === 1) {
      e.preventDefault();
      handleCheckIn(notYet[0]);
    }
  }

  function emptyNotYetMessage() {
    if (visible.length > 0) return searching ? "No match among members not yet checked in." : "Everyone here is checked in. 🎉";
    if (searching) return "No member matches your search.";
    return ministry ? `No ${ministryLabel(ministry)} members.` : "No members.";
  }

  if (roster.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">
        No active service team members{scopeLabel && ` in ${scopeLabel}`} yet.{" "}
        <Link href="/members" className="text-stm-brand underline">
          Add some
        </Link>{" "}
        first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-4">
        <p className="text-3xl font-bold text-stm-brand">
          {optimistic.length}{" "}
          <span className="text-base font-medium text-stone-400">
            checked in{scopeLabel && ` from ${scopeLabel}`} · {roster.length} member{roster.length === 1 ? "" : "s"}
          </span>
        </p>
        <div className="mt-2 h-2 w-64 max-w-full rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full bg-stm-green transition-all"
            style={{ width: `${Math.min(100, (optimistic.length / roster.length) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="Search any member by name, nickname, mobile, or VGL…"
          className={`${inputCls} text-base py-3`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={ministry === ""} onClick={() => setMinistry("")}>
            All ministries
          </Chip>
          {MINISTRY_OPTIONS.map((option) => (
            <Chip key={option} active={ministry === option} onClick={() => setMinistry(option)}>
              <MinistryName ministry={option} />
            </Chip>
          ))}
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2">Not yet checked in ({remaining})</h2>
        {!browsing ? (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center text-sm text-stone-500">
            {remaining > 0 ? "Type a name above to find someone, or pick a ministry to list its members." : emptyNotYetMessage()}
          </p>
        ) : notYet.length === 0 ? (
          <p className="text-sm text-stone-400">{emptyNotYetMessage()}</p>
        ) : (
          <ul className="bg-white rounded-2xl border border-stone-200/80 shadow-sm divide-y divide-stone-100">
            {notYet.map((m) => (
              <EventRow key={m.id} member={m}>
                <button
                  type="button"
                  onClick={() => handleCheckIn(m)}
                  className="shrink-0 rounded-lg bg-stm-green px-4 py-2 text-sm font-semibold text-white hover:bg-stm-green/90 transition"
                >
                  Check in
                </button>
              </EventRow>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2">Checked in ({done.length})</h2>
        {done.length === 0 ? (
          <p className="text-sm text-stone-400">{browsing ? "No match among checked-in members." : "No check-ins yet."}</p>
        ) : (
          <ul className="bg-white rounded-2xl border border-stone-200/80 shadow-sm divide-y divide-stone-100">
            {done.map((m) => (
              <EventRow key={m.id} member={m}>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium text-stm-green">✓ {formatTime(checkedInAt.get(m.id))}</span>
                  <button
                    type="button"
                    onClick={() => handleUndo(m)}
                    disabled={pending}
                    className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
                  >
                    Undo
                  </button>
                </div>
              </EventRow>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EventRow({ member, children }: { member: RosterMember; children: React.ReactNode }) {
  const details = [
    ministryList(member.ministries),
    member.serviceAttending,
    member.vglName && `VGL: ${member.vglName}`,
  ].filter(Boolean);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-stone-900 truncate">{memberDisplayName(member)}</p>
        <p className="text-xs text-stone-500 truncate">{details.join(" · ") || "—"}</p>
      </div>
      {children}
    </li>
  );
}
