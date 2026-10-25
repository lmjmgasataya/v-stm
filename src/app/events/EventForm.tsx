"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import type { Event } from "@/db/schema";
import { Field, FormError, inputCls, primaryBtnCls, secondaryBtnCls } from "@/components/form";
import { submitKeepingValues } from "@/components/submitKeepingValues";
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
