"use client";

import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/toast/ToastContext";
import { inputCls } from "@/components/form";
import { Chip, matchesMember } from "@/components/checkInParts";
import { MinistryName } from "@/components/MinistryName";
import { MINISTRY_OPTIONS, ministryList } from "@/lib/constants";
import { memberDisplayName } from "@/lib/members";
import type { EventPerson, EventPersonCheckIn, PersonKind } from "@/lib/event-people-shared";
import { setEventRegistration } from "../../actions";

type Rsvp = boolean | null;

const KIND_FILTERS: { value: string; kind: PersonKind; label: string }[] = [
  { value: "kind:leader", kind: "leader", label: "Leaders" },
  { value: "kind:staff", kind: "staff", label: "Pastors & Staff" },
];

const STATUS_FILTERS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "none", label: "Not on list" },
] as const;
type StatusFilter = "" | (typeof STATUS_FILTERS)[number]["value"];

const OPTIONS: { value: Rsvp; label: string; activeCls: string }[] = [
  { value: true, label: "Yes", activeCls: "bg-stm-green text-white" },
  { value: false, label: "No", activeCls: "bg-red-500 text-white" },
  { value: null, label: "—", activeCls: "bg-stone-500 text-white" },
];

const PAGE = 100;

const displayName = (p: EventPerson) => (p.lastName ? memberDisplayName(p) : `${p.firstName}${p.nickname ? ` (${p.nickname})` : ""}`);

/**
 * Everyone (STMs, leaders, pastors & staff) with this event's RSVP: Yes = pre-registered,
 * No = said they can't come, — = not on the list. Each change saves right away.
 */
export function RegistrationEditor({
  eventId,
  people,
  outside,
  checkIns,
}: {
  eventId: number;
  people: EventPerson[];
  /** Keys of people on the list who aren't in the event's invited services/groups */
  outside: string[];
  checkIns: EventPersonCheckIn[];
}) {
  const [rsvp, setRsvp] = useState(() => new Map(people.map((p) => [p.key, p.registered])));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [limit, setLimit] = useState(PAGE);
  const [saving, setSaving] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { showToast } = useToast();
  const checkedIn = useMemo(() => new Map(checkIns.map((c) => [c.key, c])), [checkIns]);
  const outsideSet = useMemo(() => new Set(outside), [outside]);

  const statusOf = (p: EventPerson) => rsvp.get(p.key) ?? null;
  const visible = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return people.filter((p) => {
      const kind = KIND_FILTERS.find((k) => k.value === filter);
      if (filter && (kind ? p.kind !== kind.kind : p.kind !== "stm" || !p.ministries.includes(filter))) return false;
      const s = rsvp.get(p.key) ?? null;
      if (status === "yes" && s !== true) return false;
      if (status === "no" && s !== false) return false;
      if (status === "none" && s !== null) return false;
      return !tokens.length || matchesMember(p, tokens);
    });
  }, [people, query, filter, status, rsvp]);

  const values = [...rsvp.values()];
  const yes = values.filter((v) => v === true).length;
  const no = values.filter((v) => v === false).length;

  function change(person: EventPerson, value: Rsvp) {
    const previous = statusOf(person);
    if (previous === value) return;
    setRsvp((m) => new Map(m).set(person.key, value));
    setSaving(person.key);
    startTransition(async () => {
      const result = await setEventRegistration(eventId, person.key, value);
      setSaving(null);
      if (!result.ok) {
        setRsvp((m) => new Map(m).set(person.key, previous));
        showToast("warning", `${person.firstName} ${person.lastName}: ${result.error}`);
      }
    });
  }

  const ministriesHere = MINISTRY_OPTIONS.filter((m) => people.some((p) => p.kind === "stm" && p.ministries.includes(m)));
  const kindsHere = KIND_FILTERS.filter((k) => people.some((p) => p.kind === k.kind));

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-4 flex flex-wrap items-end gap-x-6 gap-y-2">
        <p className="text-3xl font-bold text-stm-green">
          {yes} <span className="text-base font-medium text-stone-400">will attend</span>
        </p>
        <p className="text-xl font-bold text-red-500">
          {no} <span className="text-sm font-medium text-stone-400">won&apos;t attend</span>
        </p>
        <p className="text-xl font-bold text-stone-700">
          {yes + no} <span className="text-sm font-medium text-stone-400">invited</span>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Search anyone by name, nickname, mobile, or VGL…"
          className={`${inputCls} text-base py-3`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={filter === ""} onClick={() => setFilter("")}>
            Everyone
          </Chip>
          {ministriesHere.map((m) => (
            <Chip key={m} active={filter === m} onClick={() => setFilter(m)}>
              <MinistryName ministry={m} />
            </Chip>
          ))}
          {kindsHere.map((k) => (
            <Chip key={k.value} active={filter === k.value} onClick={() => setFilter(k.value)}>
              {k.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">RSVP:</span>
          <Chip active={status === ""} onClick={() => setStatus("")}>
            Any
          </Chip>
          {STATUS_FILTERS.map((s) => (
            <Chip key={s.value} active={status === s.value} onClick={() => setStatus(s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center text-sm text-stone-500">
          No one is invited yet — choose who&apos;s invited on the event&apos;s edit page.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-stone-400">No one matches.</p>
      ) : (
        <ul className="bg-white rounded-2xl border border-stone-200/80 shadow-sm divide-y divide-stone-100">
          {visible.slice(0, limit).map((p) => {
            const current = statusOf(p);
            const c = checkedIn.get(p.key);
            return (
              <li key={p.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900 truncate">
                    {displayName(p)}
                    {p.kind !== "stm" && (
                      <span className="ml-2 rounded-full bg-stm-brand/10 px-2 py-0.5 text-[11px] font-semibold text-stm-brand align-middle">
                        {p.kind === "leader" ? "Leader" : "Pastor/Staff"}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-stone-500 truncate">
                    {[p.kind === "stm" ? ministryList(p.ministries) : p.ministries.join(", "), p.kind !== "staff" && p.detail]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {c && <p className="text-xs text-stm-green">Checked in{c.isWalkIn ? " (walk-in)" : ""}</p>}
                  {outsideSet.has(p.key) && <p className="text-xs text-stm-amber">Not in who&apos;s invited — set to — to remove</p>}
                </div>
                <div
                  role="radiogroup"
                  aria-label={`RSVP for ${displayName(p)}`}
                  className={`flex shrink-0 overflow-hidden rounded-full ring-1 ring-stone-200 ${saving === p.key ? "opacity-60" : ""}`}
                >
                  {OPTIONS.map((o) => {
                    const active = current === o.value;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={o.value === null ? "Not on the list" : undefined}
                        onClick={() => change(p, o.value)}
                        className={`px-3.5 py-1.5 text-xs font-semibold transition ${
                          active ? o.activeCls : "bg-white text-stone-500 hover:bg-stone-50"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {visible.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="self-center text-sm font-semibold text-stm-brand hover:underline"
        >
          Show more ({visible.length - limit} left)
        </button>
      )}
    </div>
  );
}
