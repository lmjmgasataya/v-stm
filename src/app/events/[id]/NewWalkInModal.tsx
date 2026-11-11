"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { Field, FormError, Select, primaryBtnCls, secondaryBtnCls } from "@/components/form";
import { MINISTRY_OPTIONS, SERVICE_ATTENDING_OPTIONS } from "@/lib/constants";
import { addWalkIn, type NewWalkInResult } from "../actions";

/** Adds someone who isn't in the app yet as an STM and checks them in as a walk-in. */
export function NewWalkInModal({
  eventId,
  preRegistration,
  onClose,
  onAdded,
}: {
  eventId: number;
  preRegistration: boolean;
  onClose: () => void;
  onAdded: (result: Extract<NewWalkInResult, { ok: true }>) => void;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (key: string) => String(data.get(key) ?? "");
    setError(undefined);
    startTransition(async () => {
      const result = await addWalkIn(eventId, {
        lastName: get("lastName"),
        firstName: get("firstName"),
        ministry: get("ministry"),
        serviceAttending: get("serviceAttending"),
      });
      if (result.ok) onAdded(result);
      else setError(result.error);
    });
  }

  return (
    <Modal title={preRegistration ? "New walk-in" : "Add someone new"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-stone-500">
          For someone who isn&apos;t in the list yet. They&apos;re added as a service team member and checked in
          {preRegistration ? " as a walk-in" : ""}.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Last name" name="lastName" required autoFocus autoComplete="off" />
          <Field label="First name" name="firstName" required autoComplete="off" />
        </div>
        <Select label="Ministry" name="ministry" options={MINISTRY_OPTIONS} required />
        <Select label="Service" name="serviceAttending" options={SERVICE_ATTENDING_OPTIONS} required />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnCls}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={primaryBtnCls}>
            {pending ? "Saving…" : preRegistration ? "Add & check in as walk-in" : "Add & check in"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
