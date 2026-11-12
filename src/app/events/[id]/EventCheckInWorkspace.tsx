"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast/ToastContext";
import { inputCls } from "@/components/form";
import { Chip, matchesMember } from "@/components/checkInParts";
import { MINISTRY_OPTIONS } from "@/lib/constants";
import { formatTime } from "@/lib/date";
import { memberDisplayName } from "@/lib/members";
import type { EventPerson, EventPersonCheckIn, PersonKind } from "@/lib/event-people-shared";
import { checkInToEvent, undoEventCheckIn } from "../actions";
import { NewWalkInModal } from "./NewWalkInModal";

type OptimisticUpdate = { type: "add"; checkIn: EventPersonCheckIn } | { type: "remove"; key: string };

function applyUpdate(rows: EventPersonCheckIn[], update: OptimisticUpdate): EventPersonCheckIn[] {
  return update.type === "add"
    ? [...rows.filter((c) => c.key !== update.checkIn.key), update.checkIn]
    : rows.filter((c) => c.key !== update.key);
}

// Pull in check-ins made from other devices (each refresh re-renders the page on the server, so keep it sparse)
const REFRESH_INTERVAL_MS = 60_000;

/** "" = everyone; a ministry name = STMs in it; "kind:leader" / "kind:staff" = that list */
type Filter = string;
const KIND_FILTERS: { value: Filter; kind: PersonKind; label: string }[] = [
  { value: "kind:leader", kind: "leader", label: "Leaders" },
  { value: "kind:staff", kind: "staff", label: "Pastors & Staff" },
];

function matchesFilter(p: EventPerson, filter: Filter) {
  if (!filter) return true;
  const kind = KIND_FILTERS.find((k) => k.value === filter);
  return kind ? p.kind === kind.kind : p.kind === "stm" && p.ministries.includes(filter);
}

const displayName = (p: EventPerson) => (p.lastName ? memberDisplayName(p) : `${p.firstName}${p.nickname ? ` (${p.nickname})` : ""}`);
const shortName = (p: EventPerson) => `${p.firstName} ${p.lastName}`.trim();

/**
 * Check-in for a custom event: any active STM, leader or pastor/staff, from every service
 * (even for service-group users), no service times.
 * With pre-registration on, the list is the people who said they'll attend; searching also
 * finds everyone else, who can still be checked in as a walk-in.
 * Like the service check-in, the roster is preloaded for instant search but the lists stay
 * hidden until someone searches or picks a filter.
 */
export function EventCheckInWorkspace({
  eventId,
  preRegistration,
  people: serverPeople,
  checkIns,
}: {
  eventId: number;
  preRegistration: boolean;
  people: EventPerson[];
  checkIns: EventPersonCheckIn[];
}) {
  const [filter, setFilter] = useState<Filter>("");
  const [addingNew, setAddingNew] = useState(false);
  // People added as new walk-ins here, until the next server render includes them
  const [added, setAdded] = useState<EventPerson[]>([]);
  const people = useMemo(
    () => [...serverPeople, ...added.filter((a) => !serverPeople.some((p) => p.key === a.key))],
    [serverPeople, added]
  );
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  // Check-ins/undos confirmed since the last server render (the actions don't re-render the
  // page). A new `checkIns` from the periodic refresh already includes them, so they reset then.
  const [confirmed, setConfirmed] = useState({ base: checkIns, rows: checkIns });
  const currentCheckIns = confirmed.base === checkIns ? confirmed.rows : checkIns;
  function keepResult(update: OptimisticUpdate) {
    setConfirmed((c) => ({ base: checkIns, rows: applyUpdate(c.base === checkIns ? c.rows : checkIns, update) }));
  }
  const [optimistic, applyOptimistic] = useOptimistic(currentCheckIns, applyUpdate);
  const { showToast } = useToast();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  const byKey = useMemo(() => new Map(optimistic.map((c) => [c.key, c])), [optimistic]);
  /** Expected at the door: pre-registered as attending (or everyone, without pre-registration) */
  const expected = (p: EventPerson) => !preRegistration || p.registered === true;

  const searching = query.trim() !== "";
  const browsing = searching || filter !== "";
  const visible = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return people.filter((p) => matchesFilter(p, filter) && (!tokens.length || matchesMember(p, tokens)));
  }, [people, query, filter]);

  const notYet = visible.filter((p) => expected(p) && !byKey.has(p.key));
  // Walk-ins only come up when searching for someone, not when browsing a filter
  const walkInCandidates = preRegistration && searching ? visible.filter((p) => !expected(p) && !byKey.has(p.key)) : [];
  const done = visible
    .filter((p) => byKey.has(p.key))
    .sort((a, b) => byKey.get(b.key)!.checkedInAt.localeCompare(byKey.get(a.key)!.checkedInAt)); // latest first

  const preRegistered = people.filter((p) => p.registered === true).length;
  const walkIns = optimistic.filter((c) => c.isWalkIn).length;
  const remaining = people.filter((p) => matchesFilter(p, filter) && expected(p) && !byKey.has(p.key)).length;

  function handleCheckIn(person: EventPerson) {
    startTransition(async () => {
      const walkIn = preRegistration && person.registered !== true;
      applyOptimistic({ type: "add", checkIn: { key: person.key, isWalkIn: walkIn, checkedInAt: new Date().toISOString() } });
      const result = await checkInToEvent(eventId, person.key);
      if (result.checkedInAt) {
        keepResult({ type: "add", checkIn: { key: person.key, isWalkIn: result.isWalkIn ?? walkIn, checkedInAt: result.checkedInAt } });
      }
      if (result.ok) {
        showToast("success", `${shortName(person)} checked in${result.isWalkIn ? " as a walk-in" : ""}.`);
        // Back to a clean slate for the next person: no search, no filter
        setQuery("");
        setFilter("");
        searchRef.current?.focus();
      } else {
        showToast("warning", `${shortName(person)}: ${result.error}`);
      }
    });
  }

  function handleUndo(person: EventPerson) {
    if (!confirm(`Undo check-in for ${shortName(person)}?`)) return;
    startTransition(async () => {
      applyOptimistic({ type: "remove", key: person.key });
      await undoEventCheckIn(eventId, person.key);
      keepResult({ type: "remove", key: person.key });
      showToast("success", `Check-in undone for ${shortName(person)}.`);
    });
  }

  function handleNewWalkIn(result: { person: EventPerson; checkIn: EventPersonCheckIn }) {
    setAdded((a) => [...a, result.person]);
    keepResult({ type: "add", checkIn: result.checkIn });
    setAddingNew(false);
    showToast("success", `${shortName(result.person)} added and checked in${result.checkIn.isWalkIn ? " as a walk-in" : ""}.`);
    setQuery("");
    setFilter("");
    searchRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter checks in the only matching expected person — fast path for a busy line.
    // Walk-ins always take a deliberate tap.
    if (e.key !== "Enter" || !searching) return;
    if (notYet.length === 1 && visible.filter(expected).length === 1) {
      e.preventDefault();
      handleCheckIn(notYet[0]);
    }
  }

  function filterLabel() {
    const kind = KIND_FILTERS.find((k) => k.value === filter);
    return kind ? kind.label : filter;
  }

  function emptyNotYetMessage() {
    if (visible.some(expected)) {
      return searching
        ? `No match among ${preRegistration ? "pre-registered people" : "people"} not yet checked in.`
        : "Everyone here is checked in.";
    }
    if (searching) return preRegistration ? "No pre-registered person matches your search." : "No one matches your search.";
    return filter ? `No one ${preRegistration ? "pre-registered " : ""}in ${filterLabel()}.` : "No one to check in.";
  }

  if (people.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">
        No active service team members, leaders or staff yet.
      </div>
    );
  }

  const ministriesHere = MINISTRY_OPTIONS.filter((m) => people.some((p) => p.kind === "stm" && p.ministries.includes(m)));
  const kindsHere = KIND_FILTERS.filter((k) => people.some((p) => p.kind === k.kind));

  return (
    <div className="flex flex-col gap-5">
      {/* Tinted, not white: a summary, so it doesn't look like the search field below */}
      <div className="rounded-2xl border border-stm-brand/15 bg-stm-brand/[0.06] p-4">
        {preRegistration ? (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="text-3xl font-bold text-stm-brand">
              {optimistic.length - walkIns}
              <span className="text-base font-medium text-stone-500"> of {preRegistered} pre-registered checked in</span>
            </p>
            <p className="text-xl font-bold text-stm-amber">
              {walkIns} <span className="text-sm font-medium text-stone-500">walk-ins</span>
            </p>
            <p className="text-xl font-bold text-stone-700">
              {optimistic.length} <span className="text-sm font-medium text-stone-500">total present</span>
            </p>
          </div>
        ) : (
          // Just the count — not everyone is expected at an event, so no total or progress bar
          <p className="text-3xl font-bold text-stm-brand">
            {optimistic.length} <span className="text-base font-medium text-stone-500">checked in</span>
          </p>
        )}
      </div>

      {/* Separates the counts above from the check-in tools below */}
      <div className="flex items-center gap-3 pt-2">
        <span className="h-px flex-1 bg-stone-200" aria-hidden="true" />
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-stm-brand">
          <span className="h-2 w-2 rounded-full bg-stm-green" aria-hidden="true" />
          Check in
        </h2>
        <span className="h-px flex-1 bg-stone-200" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder="Search anyone by name, nickname, mobile, or VGL…"
            className={`${inputCls} text-base py-3`}
          />
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            className="shrink-0 rounded-xl border border-stm-amber/50 bg-white px-3 text-sm font-semibold text-stm-amber hover:bg-stm-amber/10 transition"
          >
            + New {preRegistration ? "walk-in" : "person"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={filter === ""} onClick={() => setFilter("")}>
            Everyone
          </Chip>
          {ministriesHere.map((option) => (
            <Chip key={option} active={filter === option} onClick={() => setFilter(option)}>
              {option}
            </Chip>
          ))}
          {kindsHere.map((k) => (
            <Chip key={k.value} active={filter === k.value} onClick={() => setFilter(k.value)}>
              {k.label}
            </Chip>
          ))}
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2">
          {preRegistration ? `Pre-registered (${remaining} not yet here)` : "Check someone in"}
        </h2>
        {!browsing ? (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center text-sm text-stone-500">
            {remaining > 0
              ? `Type a name above to find someone, or pick a ministry or list.${preRegistration ? " People who didn't pre-register come up as walk-ins when you search." : ""}`
              : emptyNotYetMessage()}
          </p>
        ) : notYet.length === 0 ? (
          <p className="text-sm text-stone-400">{emptyNotYetMessage()}</p>
        ) : (
          <ul className="bg-white rounded-2xl border border-stone-200/80 shadow-sm divide-y divide-stone-100">
            {notYet.map((p) => (
              <PersonRow key={p.key} person={p}>
                <button
                  type="button"
                  onClick={() => handleCheckIn(p)}
                  className="shrink-0 rounded-lg bg-stm-green px-4 py-2 text-sm font-semibold text-white hover:bg-stm-green/90 transition"
                >
                  Check in
                </button>
              </PersonRow>
            ))}
          </ul>
        )}
      </section>

      {searching && notYet.length === 0 && walkInCandidates.length === 0 && (
        <p className="text-sm text-stone-500">
          Not in the list?{" "}
          <button type="button" onClick={() => setAddingNew(true)} className="font-semibold text-stm-amber hover:underline">
            Add them as a new {preRegistration ? "walk-in" : "person"}
          </button>
          .
        </p>
      )}

      {addingNew && (
        <NewWalkInModal
          eventId={eventId}
          preRegistration={preRegistration}
          onClose={() => setAddingNew(false)}
          onAdded={handleNewWalkIn}
        />
      )}

      {walkInCandidates.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2">Not pre-registered — walk-in</h2>
          <ul className="bg-white rounded-2xl border border-stm-amber/40 shadow-sm divide-y divide-stone-100">
            {walkInCandidates.map((p) => (
              <PersonRow key={p.key} person={p} note={p.registered === false ? "Said they couldn't attend" : "Not on this event's list"}>
                <button
                  type="button"
                  onClick={() => handleCheckIn(p)}
                  className="shrink-0 rounded-lg bg-stm-amber px-4 py-2 text-sm font-semibold text-white hover:bg-stm-amber/90 transition"
                >
                  Check in as walk-in
                </button>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2">Checked in ({done.length})</h2>
        {done.length === 0 ? (
          <p className="text-sm text-stone-400">{browsing ? "No match among people checked in." : "No check-ins yet."}</p>
        ) : (
          <ul className="bg-white rounded-2xl border border-stone-200/80 shadow-sm divide-y divide-stone-100">
            {done.map((p) => {
              const c = byKey.get(p.key)!;
              return (
                <PersonRow key={p.key} person={p}>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.isWalkIn && (
                      <span className="rounded-full bg-stm-amber/15 px-2 py-0.5 text-xs font-semibold text-stm-amber">Walk-in</span>
                    )}
                    <span className="text-sm font-medium text-stm-green">✓ {formatTime(c.checkedInAt)}</span>
                    <button
                      type="button"
                      onClick={() => handleUndo(p)}
                      disabled={pending}
                      className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
                    >
                      Undo
                    </button>
                  </div>
                </PersonRow>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const KIND_BADGES: Partial<Record<PersonKind, string>> = { leader: "Leader", staff: "Pastor/Staff" };

function PersonRow({ person, note, children }: { person: EventPerson; note?: string; children: React.ReactNode }) {
  const details = [
    person.ministries.join(", "),
    person.kind !== "staff" && person.detail,
    person.vglName && `VGL: ${person.vglName}`,
  ].filter(Boolean);
  const badge = KIND_BADGES[person.kind];
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-stone-900 truncate">
          {displayName(person)}
          {badge && (
            <span className="ml-2 rounded-full bg-stm-brand/10 px-2 py-0.5 text-[11px] font-semibold text-stm-brand align-middle">
              {badge}
            </span>
          )}
        </p>
        <p className="text-xs text-stone-500 truncate">{details.join(" · ") || "—"}</p>
        {note && <p className="text-xs text-stm-amber truncate">{note}</p>}
      </div>
      {children}
    </li>
  );
}
