"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/toast/ToastContext";
import { inputCls } from "@/components/form";
import { MINISTRY_OPTIONS, ministryLabel, ministryList } from "@/lib/constants";
import { MinistryName } from "@/components/MinistryName";
import { Chip, matchesMember } from "@/components/checkInParts";
import { formatTime } from "@/lib/date";
import { memberDisplayName } from "@/lib/members";
import { checkIn, undoCheckIn } from "./actions";

export interface RosterMember {
  id: number;
  lastName: string;
  firstName: string;
  middleInitial: string;
  nickname: string | null;
  mobileNumber: string;
  serviceAttending: string | null;
  vglName: string | null;
  ministries: string[];
}

export interface TodayCheckIn {
  memberId: number;
  service: string;
  checkedInAt: string;
}

interface Group {
  name: string;
  services: string[];
}

type OptimisticUpdate = { type: "add"; checkIns: TodayCheckIn[] } | { type: "remove"; memberId: number; service: string };

// Pull in check-ins made from other devices
const REFRESH_INTERVAL_MS = 20_000;

/** "2PM - Mandurriao" → "2PM" */
const timeOf = (service: string) => service.split(" - ")[0];
/** "2PM - Mandurriao" → "Mandurriao" */
const placeOf = (service: string) => service.split(" - ")[1] ?? "";

export function CheckInWorkspace({
  groups,
  initialGroup,
  scoped,
  todayLabel,
  roster,
  checkIns,
}: {
  /** Service groups this user can check in to (just their own when scoped). */
  groups: Group[];
  initialGroup: string;
  /** Signed in as a service-group user: the roster is already only their services. */
  scoped: boolean;
  todayLabel: string;
  roster: RosterMember[];
  checkIns: TodayCheckIn[];
}) {
  const [groupName, setGroupName] = useState(initialGroup);
  const group = groups.find((g) => g.name === groupName) ?? groups[0];
  // Which of the group's services a check-in records — both by default (e.g. 2PM + 4PM)
  const [selected, setSelected] = useState<string[]>(group.services);
  const [ministry, setMinistry] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [optimisticCheckIns, applyOptimistic] = useOptimistic(checkIns, (rows, update: OptimisticUpdate) =>
    update.type === "add"
      ? [...rows, ...update.checkIns]
      : rows.filter((c) => !(c.memberId === update.memberId && c.service === update.service))
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

  function chooseGroup(next: Group) {
    setGroupName(next.name);
    setSelected(next.services);
    // Keep the choice in the URL (for reloads/bookmarks) without a server round trip
    window.history.replaceState(null, "", `?group=${encodeURIComponent(next.name)}`);
    searchRef.current?.focus();
  }

  function toggleService(service: string) {
    setSelected((current) =>
      current.includes(service)
        ? current.length > 1
          ? current.filter((s) => s !== service)
          : current // keep at least one
        : group.services.filter((s) => s === service || current.includes(s))
    );
  }

  // memberId → (service → check-in time), for this group's services; and other services checked in today
  const { byMember, otherServices } = useMemo(() => {
    const here = new Map<number, Map<string, string>>();
    const others = new Map<number, string[]>();
    for (const c of optimisticCheckIns) {
      if (group.services.includes(c.service)) {
        if (!here.has(c.memberId)) here.set(c.memberId, new Map());
        here.get(c.memberId)!.set(c.service, c.checkedInAt);
      } else {
        others.set(c.memberId, [...(others.get(c.memberId) ?? []), c.service]);
      }
    }
    return { byMember: here, otherServices: others };
  }, [optimisticCheckIns, group]);

  const missingFor = (m: RosterMember) => selected.filter((s) => !byMember.get(m.id)?.has(s));

  const searching = query.trim() !== "";
  // The whole roster is preloaded so search is instant, but the not-yet list stays hidden
  // until someone searches or picks a ministry — no wall of names to scroll through.
  const browsing = searching || ministry !== "";

  // This group's members (and anyone already checked in to it), narrowed by the ministry chip
  const inGroup = useMemo(
    () =>
      roster.filter(
        (m) =>
          (!ministry || m.ministries.includes(ministry)) &&
          (showAll || group.services.includes(m.serviceAttending ?? "") || byMember.has(m.id))
      ),
    [roster, ministry, showAll, group, byMember]
  );
  const visible = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return inGroup;
    // Searching looks across every service you can see, not just this group
    return roster.filter((m) => (!ministry || m.ministries.includes(ministry)) && matchesMember(m, tokens));
  }, [roster, inGroup, query, ministry]);

  // Not yet = missing any of the ticked services (so they still need a check-in)
  const remaining = inGroup.filter((m) => missingFor(m).length > 0).length;
  const notYet = visible.filter((m) => missingFor(m).length > 0);
  // Checked in = anyone with a check-in to any of the group's services today, whatever is
  // ticked — their chips show which ones. Someone with only 2PM while both are ticked
  // appears here and in "not yet" (with a "Check in 4PM" button).
  const done = visible
    .filter((m) => byMember.has(m.id))
    .sort((a, b) => latest(byMember.get(b.id)).localeCompare(latest(byMember.get(a.id)))); // latest first

  const assignedCount = roster.filter((m) => group.services.includes(m.serviceAttending ?? "")).length;
  const countFor = (service: string) => optimisticCheckIns.filter((c) => c.service === service).length;

  function handleCheckIn(member: RosterMember) {
    const services = missingFor(member);
    if (services.length === 0) return;
    const label = services.map(timeOf).join(" & ");
    startTransition(async () => {
      const now = new Date().toISOString();
      applyOptimistic({ type: "add", checkIns: services.map((service) => ({ memberId: member.id, service, checkedInAt: now })) });
      const result = await checkIn(member.id, services);
      if (!result.ok) {
        showToast("warning", `${member.firstName} ${member.lastName}: ${result.error}`);
      } else if (result.checkedIn.length === 0) {
        showToast("warning", `${member.firstName} ${member.lastName} was already checked in to ${label}.`);
      } else {
        showToast("success", `${member.firstName} ${member.lastName} checked in to ${label}.`);
        // Back to a clean slate for the next person: no search, All ministries
        setQuery("");
        setMinistry("");
        searchRef.current?.focus();
      }
    });
  }

  function handleUndo(member: RosterMember, service: string) {
    if (!confirm(`Undo ${timeOf(service)} check-in for ${member.firstName} ${member.lastName}?`)) return;
    startTransition(async () => {
      applyOptimistic({ type: "remove", memberId: member.id, service });
      await undoCheckIn(member.id, service);
      showToast("success", `${timeOf(service)} check-in undone for ${member.firstName} ${member.lastName}.`);
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

  // Only celebrate when there were members to check in; an empty list just means nobody is assigned
  function emptyNotYetMessage() {
    if (visible.length > 0) {
      return searching ? "No match among members not yet checked in." : "Everyone here is checked in. 🎉";
    }
    if (searching) return "No member matches your search.";
    const who = ministry ? `${ministryLabel(ministry)} members` : "members";
    return `No ${who} assigned to ${group.name} yet.${scoped ? "" : " Tick “Show members of other services” to check in someone from another service."}`;
  }

  function rowChips(m: RosterMember) {
    const times = byMember.get(m.id);
    return group.services
      .filter((s) => times?.has(s))
      .map((s) => (
        <span
          key={s}
          className="inline-flex items-center gap-1 rounded-full bg-stm-green/10 px-2 py-0.5 text-xs font-semibold text-stm-green whitespace-nowrap"
        >
          ✓ {timeOf(s)} · {formatTime(times!.get(s))}
          <button
            type="button"
            onClick={() => handleUndo(m, s)}
            disabled={pending}
            aria-label={`Undo ${timeOf(s)} check-in`}
            title={`Undo ${timeOf(s)} check-in`}
            className="ml-0.5 text-stone-400 hover:text-red-600 disabled:opacity-50"
          >
            ×
          </button>
        </span>
      ));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Check-in{scoped && ` · ${group.name}`}</h1>
        <p className="text-sm text-stone-500">{todayLabel}</p>
      </div>

      {groups.length > 1 && (
        <div>
          <p className="text-sm font-medium text-stone-700 mb-2">Service</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {groups.map((g) => {
              const count = optimisticCheckIns.filter((c) => g.services.includes(c.service)).length;
              return (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => chooseGroup(g)}
                  className={`shrink-0 whitespace-nowrap rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${
                    g.name === group.name
                      ? "bg-stm-brand border-stm-brand text-white shadow-md"
                      : "bg-white border-stone-200 text-stone-500 hover:border-stm-brand/50 hover:text-stm-brand"
                  }`}
                >
                  <span className="block">{g.name}</span>
                  <span className="block text-xs font-medium opacity-80">{placeOf(g.services[0])}</span>
                  {count > 0 && <span className="block text-xs font-normal opacity-80">{count} in</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-4 flex flex-col gap-4">
        {group.services.length > 1 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-stone-700">Checking in for:</span>
            {group.services.map((s) => {
              const checked = selected.includes(s);
              return (
                <label
                  key={s}
                  className={`inline-flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm font-semibold cursor-pointer transition ${
                    checked ? "border-stm-brand bg-stm-brand/5 text-stm-brand" : "border-stone-200 text-stone-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    // The last ticked service can't be unticked
                    disabled={checked && selected.length === 1}
                    onChange={() => toggleService(s)}
                    className="h-4 w-4 accent-stm-brand"
                  />
                  {timeOf(s)}
                </label>
              );
            })}
            <span className="text-xs text-stone-400">
              {selected.length === group.services.length ? "Serving both" : `Only ${timeOf(selected[0])}`}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          {group.services.map((s) => (
            <p key={s} className="text-3xl font-bold text-stm-brand">
              {countFor(s)} <span className="text-base font-medium text-stone-400">checked in · {timeOf(s)}</span>
            </p>
          ))}
          <p className="text-sm text-stone-400">{assignedCount} assigned to {group.name}</p>
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
          placeholder="Search by name, nickname, mobile, or VGL…"
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
          {!scoped && (
            <label className="ml-auto flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 accent-stm-brand" />
              Show members of other services
            </label>
          )}
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">
          No active service team members yet. <Link href="/members" className="text-stm-brand underline">Add some</Link> first.
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2">
              Check someone in
            </h2>
            {!browsing ? (
              <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center text-sm text-stone-500">
                {remaining > 0
                  ? "Type a name above to find someone, or pick a ministry to list its members."
                  : emptyNotYetMessage()}
              </p>
            ) : notYet.length === 0 ? (
              <p className="text-sm text-stone-400">{emptyNotYetMessage()}</p>
            ) : (
              <ul className="bg-white rounded-2xl border border-stone-200/80 shadow-sm divide-y divide-stone-100">
                {notYet.map((m) => {
                  const missing = missingFor(m);
                  const partial = missing.length < selected.length;
                  return (
                    <MemberRow key={m.id} member={m} group={group} chips={rowChips(m)} otherServices={otherServices.get(m.id)}>
                      <button
                        type="button"
                        onClick={() => handleCheckIn(m)}
                        className="shrink-0 rounded-lg bg-stm-green px-4 py-2 text-sm font-semibold text-white hover:bg-stm-green/90 transition"
                      >
                        {partial || group.services.length > 1 ? `Check in ${missing.map(timeOf).join(" & ")}` : "Check in"}
                      </button>
                    </MemberRow>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2">
              Checked in to {group.services.map(timeOf).join(" & ")} ({done.length})
            </h2>
            {done.length === 0 ? (
              <p className="text-sm text-stone-400">No check-ins yet.</p>
            ) : (
              <ul className="bg-white rounded-2xl border border-stone-200/80 shadow-sm divide-y divide-stone-100">
                {done.map((m) => (
                  <MemberRow key={m.id} member={m} group={group} chips={rowChips(m)} otherServices={otherServices.get(m.id)} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function latest(times: Map<string, string> | undefined): string {
  return times ? [...times.values()].sort().at(-1)! : "";
}

function MemberRow({
  member,
  group,
  chips,
  otherServices,
  children,
}: {
  member: RosterMember;
  group: Group;
  chips: React.ReactNode[];
  otherServices: string[] | undefined;
  children?: React.ReactNode;
}) {
  const details = [
    ministryList(member.ministries),
    member.serviceAttending && (group.services.length > 1 || member.serviceAttending !== group.services[0])
      ? `Usually ${timeOf(member.serviceAttending)}${group.services.includes(member.serviceAttending) ? "" : ` (${placeOf(member.serviceAttending)})`}`
      : null,
    member.vglName && `VGL: ${member.vglName}`,
  ].filter(Boolean);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-stone-900 truncate">{memberDisplayName(member)}</p>
        <p className="text-xs text-stone-500 truncate">{details.join(" · ") || "—"}</p>
        {otherServices && (
          <p className="text-xs text-stm-amber truncate">Also checked in today: {otherServices.join(", ")}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {chips}
        {children}
      </div>
    </li>
  );
}
