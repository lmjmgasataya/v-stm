"use client";

import { useMemo, useState, useTransition } from "react";
import type { Leader, Staff } from "@/db/schema";
import { Modal } from "@/components/Modal";
import { Field, FormError, Select, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/form";
import { useToast } from "@/components/toast/ToastContext";
import { SERVICE_GROUP_NAMES } from "@/lib/constants";
import { saveLeader, saveStaff, type SaveResult } from "./actions";

type SortDir = "asc" | "desc";
const byText = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });
const byName = (a: { lastName: string; firstName: string }, b: { lastName: string; firstName: string }) =>
  byText(a.lastName, b.lastName) || byText(a.firstName, b.firstName);

const personName = (p: { lastName: string; firstName: string; nickname: string | null }) =>
  `${p.lastName ? `${p.lastName}, ` : ""}${p.firstName}${p.nickname ? ` (${p.nickname})` : ""}`;

/** Click to sort; clicking the sorted column again flips the direction. */
function SortHeader<K extends string>({
  column,
  label,
  sort,
  setSort,
}: {
  column: K;
  label: string;
  sort: { column: K; dir: SortDir };
  setSort: (s: { column: K; dir: SortDir }) => void;
}) {
  const active = sort.column === column;
  return (
    <th className="px-4 py-2.5 text-left font-semibold" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => setSort({ column, dir: active && sort.dir === "asc" ? "desc" : "asc" })}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-stm-brand transition ${active ? "text-stm-brand" : ""}`}
      >
        {label}
        <span aria-hidden="true" className={active ? "" : "opacity-30"}>
          {active && sort.dir === "desc" ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}

const thCls = "px-4 py-2.5 text-left font-semibold";
const tdCls = "px-4 py-2.5 whitespace-nowrap";
const tableWrap = "bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-x-auto";

function SectionHeader({ title, count, onAdd, addLabel }: { title: string; count: string; onAdd?: () => void; addLabel: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        {title} ({count})
      </h2>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="rounded-full bg-stm-brand px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-stm-brand-dark transition"
        >
          + {addLabel}
        </button>
      )}
    </div>
  );
}

function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="text-stm-brand hover:underline" aria-label={label}>
      Edit
    </button>
  );
}

function InactiveTag() {
  return <span className="ml-2 text-xs font-normal text-stone-400">(inactive)</span>;
}

// ---- Leaders

type LeaderSort = "name" | "service";

export function LeadersTable({ rows, total, canEdit }: { rows: Leader[]; total: number; canEdit: boolean }) {
  const [sort, setSort] = useState<{ column: LeaderSort; dir: SortDir }>({ column: "name", dir: "asc" });
  const [editing, setEditing] = useState<Leader | "new" | null>(null);

  const sorted = useMemo(() => {
    const sign = sort.dir === "asc" ? 1 : -1;
    // Service in SERVICE_GROUPS order, unknown last whichever direction
    const order = (l: Leader) => (l.serviceGroup ? SERVICE_GROUP_NAMES.indexOf(l.serviceGroup as never) : Infinity);
    return [...rows].sort((a, b) => {
      if (sort.column === "service") {
        const [oa, ob] = [order(a), order(b)];
        if (oa === Infinity || ob === Infinity) return oa === ob ? byName(a, b) : oa === Infinity ? 1 : -1;
        return sign * (oa - ob) || byName(a, b);
      }
      return sign * byName(a, b);
    });
  }, [rows, sort]);

  return (
    <section>
      <SectionHeader
        title="Leaders"
        count={rows.length === total ? String(total) : `${rows.length} of ${total}`}
        onAdd={canEdit ? () => setEditing("new") : undefined}
        addLabel="Add leader"
      />
      {sorted.length === 0 ? (
        <Empty>No leaders found.</Empty>
      ) : (
        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <SortHeader column="name" label="Name" sort={sort} setSort={setSort} />
                <SortHeader column="service" label="Service" sort={sort} setSort={setSort} />
                <th className={thCls}>ENC</th>
                <th className={thCls}>VG leader</th>
                {canEdit && <th className={thCls} />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sorted.map((l) => (
                <tr key={l.id} className={l.isActive ? "text-stone-700" : "text-stone-400"}>
                  <td className={`${tdCls} font-medium ${l.isActive ? "text-stone-900" : ""}`}>
                    {personName(l)}
                    {!l.isActive && <InactiveTag />}
                  </td>
                  <td className={tdCls}>{l.serviceGroup ?? "—"}</td>
                  <td className={tdCls}>{l.isEnc ? "ENC" : ""}</td>
                  <td className={tdCls}>{l.vgLeaderName ?? "—"}</td>
                  {canEdit && (
                    <td className={`${tdCls} text-right`}>
                      <EditButton onClick={() => setEditing(l)} label={`Edit ${personName(l)}`} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <LeaderModal leader={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function LeaderModal({ leader, onClose }: { leader: Leader | null; onClose: () => void }) {
  return (
    <PersonModal title={leader ? `Edit ${personName(leader)}` : "Add leader"} onClose={onClose} save={(fd) => saveLeader(leader?.id ?? null, fd)}>
      <NameFields person={leader} lastNameRequired />
      <Select label="Service" name="serviceGroup" options={SERVICE_GROUP_NAMES} defaultValue={leader?.serviceGroup ?? ""} />
      <Field label="VG leader" name="vgLeaderName" defaultValue={leader?.vgLeaderName ?? ""} maxLength={80} />
      <Checkbox name="isEnc" label="ENC" defaultChecked={leader?.isEnc ?? false} />
      {leader && <Checkbox name="isActive" label="Active — inactive people are hidden from event check-in" defaultChecked={leader.isActive} />}
    </PersonModal>
  );
}

// ---- Pastors & staff

type StaffSort = "name" | "ministry";

export function StaffTable({ rows, total, canEdit, ministries }: { rows: Staff[]; total: number; canEdit: boolean; ministries: string[] }) {
  const [sort, setSort] = useState<{ column: StaffSort; dir: SortDir }>({ column: "name", dir: "asc" });
  const [editing, setEditing] = useState<Staff | "new" | null>(null);

  const sorted = useMemo(() => {
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) =>
      sort.column === "ministry" ? sign * byText(a.ministry, b.ministry) || byName(a, b) : sign * byName(a, b)
    );
  }, [rows, sort]);

  return (
    <section>
      <SectionHeader
        title="Pastors & staff"
        count={rows.length === total ? String(total) : `${rows.length} of ${total}`}
        onAdd={canEdit ? () => setEditing("new") : undefined}
        addLabel="Add pastor / staff"
      />
      {sorted.length === 0 ? (
        <Empty>No pastors or staff found.</Empty>
      ) : (
        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <SortHeader column="name" label="Name" sort={sort} setSort={setSort} />
                <SortHeader column="ministry" label="Ministry" sort={sort} setSort={setSort} />
                {canEdit && <th className={thCls} />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sorted.map((s) => (
                <tr key={s.id} className={s.isActive ? "text-stone-700" : "text-stone-400"}>
                  <td className={`${tdCls} font-medium ${s.isActive ? "text-stone-900" : ""}`}>
                    {personName(s)}
                    {!s.isActive && <InactiveTag />}
                  </td>
                  <td className={tdCls}>{s.ministry}</td>
                  {canEdit && (
                    <td className={`${tdCls} text-right`}>
                      <EditButton onClick={() => setEditing(s)} label={`Edit ${personName(s)}`} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <StaffModal person={editing === "new" ? null : editing} ministries={ministries} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

function StaffModal({ person, ministries, onClose }: { person: Staff | null; ministries: string[]; onClose: () => void }) {
  return (
    <PersonModal title={person ? `Edit ${personName(person)}` : "Add pastor / staff"} onClose={onClose} save={(fd) => saveStaff(person?.id ?? null, fd)}>
      <NameFields person={person} lastNameRequired={false} />
      <div>
        <label htmlFor="ministry" className="block text-sm font-medium text-stone-700 mb-1">
          Ministry <span className="text-red-500">*</span>
        </label>
        {/* Free text with the existing values suggested (Pastor, Pastor's Wife, Admin, …) */}
        <input id="ministry" name="ministry" required list="staff-ministries" defaultValue={person?.ministry ?? ""} maxLength={80} className={inputCls} />
        <datalist id="staff-ministries">
          {ministries.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      {person && <Checkbox name="isActive" label="Active — inactive people are hidden from event check-in" defaultChecked={person.isActive} />}
    </PersonModal>
  );
}

// ---- Shared form bits

function PersonModal({
  title,
  onClose,
  save,
  children,
}: {
  title: string;
  onClose: () => void;
  save: (formData: FormData) => Promise<SaveResult>;
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(undefined);
    startTransition(async () => {
      const result = await save(formData);
      if (result.ok) {
        showToast("success", "Saved.");
        onClose();
      } else setError(result.error);
    });
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {children}
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnCls}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={primaryBtnCls}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NameFields({
  person,
  lastNameRequired,
}: {
  person: { lastName: string; firstName: string; nickname: string | null } | null;
  lastNameRequired: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Last name" name="lastName" required={lastNameRequired} defaultValue={person?.lastName ?? ""} maxLength={80} autoFocus />
      <Field label="First name" name="firstName" required defaultValue={person?.firstName ?? ""} maxLength={80} />
      <Field label="Nickname" name="nickname" defaultValue={person?.nickname ?? ""} maxLength={80} />
    </div>
  );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-stone-700">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-stm-brand" />
      {label}
    </label>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">{children}</div>;
}
