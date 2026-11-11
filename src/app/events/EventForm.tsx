"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import type { Event } from "@/db/schema";
import { Field, FormError, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/form";
import { submitKeepingValues } from "@/components/submitKeepingValues";
import { SERVICE_GROUP_NAMES } from "@/lib/constants";
import { PERSON_KINDS, PERSON_KIND_LABELS } from "@/lib/event-people-shared";
import { createEvent, deleteEvent, updateEvent, type EventFormState } from "./actions";

/** Create (no `event`) or edit an event. `canDelete` = all-services admin. */
export function EventForm({ event, defaultDate, canDelete = false }: { event?: Event; defaultDate: string; canDelete?: boolean }) {
  const action = event ? updateEvent.bind(null, event.id) : createEvent;
  const [state, dispatch, pending] = useActionState<EventFormState, FormData>(action, undefined);
  const [deleting, startDelete] = useTransition();

  return (
    <form onSubmit={submitKeepingValues(dispatch)} className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 flex flex-col gap-4 max-w-xl">
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <Field label="Event name" name="name" required maxLength={100} defaultValue={event?.name} placeholder="e.g. Prayer Night" />
        <Field label="Date" name="eventDate" type="date" required defaultValue={event?.eventDate ?? defaultDate} />
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-stone-700 mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          defaultValue={event?.notes ?? ""}
          placeholder="Time, venue, who should come…"
          className={inputCls}
        />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-stone-200 p-4">
        <legend className="px-1 text-sm font-medium text-stone-700">Who&apos;s invited</legend>
        <p className="-mt-1 text-xs text-stone-500">
          The Pre-registration list only has these people. STMs and leaders are matched by their service; pastors &amp; staff
          serve every service. Anyone else can still be checked in as a walk-in.
        </p>
        <CheckboxRow
          label="Services"
          hint="None ticked = every service"
          name="audienceGroups"
          options={SERVICE_GROUP_NAMES.map((g) => ({ value: g, label: g }))}
          defaults={event?.audienceGroups ?? []}
        />
        <CheckboxRow
          label="People"
          name="audienceKinds"
          options={PERSON_KINDS.map((k) => ({ value: k, label: PERSON_KIND_LABELS[k] }))}
          defaults={event?.audienceKinds ?? PERSON_KINDS}
        />
      </fieldset>

      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          name="preRegistration"
          defaultChecked={event?.preRegistration ?? false}
          className="mt-0.5 h-4 w-4 accent-stm-brand"
        />
        <span>
          Pre-registration
          <span className="block text-xs text-stone-500">
            Check-in lists only the people marked as attending (set on the event&apos;s Pre-registration page); anyone else is
            checked in as a walk-in.
          </span>
        </span>
      </label>

      <FormError message={state?.error} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {event && canDelete ? (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (confirm(`Delete ${event.name}? Every team's check-ins for it are deleted too.`)) {
                startDelete(() => deleteEvent(event.id));
              }
            }}
            className="text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete event"}
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Link href={event ? `/events/${event.id}` : "/events"} className={secondaryBtnCls}>
            Cancel
          </Link>
          <button type="submit" disabled={pending} className={primaryBtnCls}>
            {pending ? "Saving…" : event ? "Save changes" : "Create event"}
          </button>
        </div>
      </div>
    </form>
  );
}

function CheckboxRow({
  label,
  hint,
  name,
  options,
  defaults,
}: {
  label: string;
  hint?: string;
  name: string;
  options: { value: string; label: string }[];
  defaults: readonly string[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5">
        {label}
        {hint && <span className="ml-2 font-normal normal-case tracking-normal text-stone-400">{hint}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-sm text-stone-700 cursor-pointer has-[:checked]:border-stm-brand has-[:checked]:bg-stm-brand/5 has-[:checked]:text-stm-brand"
          >
            <input type="checkbox" name={name} value={o.value} defaultChecked={defaults.includes(o.value)} className="h-4 w-4 accent-stm-brand" />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
