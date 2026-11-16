"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { Field, FormError, Select, primaryBtnCls, secondaryBtnCls } from "@/components/form";
import { GENDER_OPTIONS, MINISTRY_OPTIONS } from "@/lib/constants";
import { addMemberAtCheckIn, type AddMemberResult } from "./actions";

/** Adds someone the search didn't find as an STM and checks them in to the ticked services. */
export function AddMemberModal({
  services,
  serviceLabel,
  attendingOptions,
  defaultAttending,
  needsApproval,
  onClose,
  onAdded,
}: {
  /** Services the new member is checked in to (the ticked ones). */
  services: string[];
  /** "2PM & 4PM" */
  serviceLabel: string;
  /** Service-attending values this user may assign (Viewer.attending). */
  attendingOptions: readonly string[];
  defaultAttending: string;
  /** Signed in as a volunteer: the new STM is pending until an admin approves. */
  needsApproval: boolean;
  onClose: () => void;
  onAdded: (result: Extract<AddMemberResult, { ok: true }>) => void;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (key: string) => String(data.get(key) ?? "");
    setError(undefined);
    startTransition(async () => {
      const result = await addMemberAtCheckIn(
        {
          lastName: get("lastName"),
          firstName: get("firstName"),
          gender: get("gender"),
          ministry: get("ministry"),
          serviceAttending: get("serviceAttending"),
        },
        services
      );
      if (result.ok) onAdded(result);
      else setError(result.error);
    });
  }

  return (
    <Modal title="Add service team member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-stone-500">
          For someone who isn&apos;t in the list yet. They&apos;re added and checked in to {serviceLabel}
          {needsApproval ? " now; an admin will review and approve them afterwards." : "."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Last name" name="lastName" required autoFocus autoComplete="off" />
          <Field label="First name" name="firstName" required autoComplete="off" />
        </div>
        <Select label="Gender" name="gender" options={GENDER_OPTIONS} required />
        <Select label="Ministry" name="ministry" options={MINISTRY_OPTIONS} required />
        <Select label="Service" name="serviceAttending" options={attendingOptions} defaultValue={defaultAttending} required />
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnCls}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={primaryBtnCls}>
            {pending ? "Saving…" : "Add & check in"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
