"use client";

import type { Member } from "@/db/schema";
import { Field, Select } from "@/components/form";
import { MinistryName } from "@/components/MinistryName";
import { VglAutocomplete } from "@/components/VglAutocomplete";
import {
  DISCIPLESHIP_JOURNEY_STEPS,
  GENDER_OPTIONS,
  LIFESTAGE_OPTIONS,
  MINISTRY_OPTIONS,
  MOBILE_NUMBER_HELP,
  MOBILE_NUMBER_PATTERN,
} from "@/lib/constants";
import { MAX_NICKNAME_LENGTH } from "@/lib/members";
import type { VglOption } from "@/lib/vgl";

/** Inputs shared by the add and edit forms; parsed by readMemberInput. */
export function MemberFields({
  vglOptions,
  serviceOptions,
  defaultValues,
  showActive = false,
}: {
  vglOptions: VglOption[];
  /** The signed-in user's services (Viewer.services). */
  serviceOptions: readonly string[];
  defaultValues?: Member;
  showActive?: boolean;
}) {
  const d = defaultValues;
  const completedSteps = (d?.discipleshipJourneyCompleted ?? "").split(",").filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Personal info">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_5rem_1fr]">
          <Field label="Last name" name="lastName" required defaultValue={d?.lastName} />
          <Field label="First name" name="firstName" required defaultValue={d?.firstName} />
          <Field label="M.I." name="middleInitial" maxLength={4} defaultValue={d?.middleInitial} />
          <Field label="Nickname" name="nickname" maxLength={MAX_NICKNAME_LENGTH} defaultValue={d?.nickname ?? undefined} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Age" name="age" type="number" min={1} max={120} defaultValue={d?.age ?? undefined} />
          <Select label="Gender" name="gender" options={GENDER_OPTIONS} defaultValue={d?.gender} required />
          <Select label="Lifestage" name="lifestage" options={LIFESTAGE_OPTIONS} defaultValue={d?.lifestage} />
        </div>
      </Section>

      <Section title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Mobile number"
            name="mobileNumber"
            type="tel"
            inputMode="tel"
            pattern={MOBILE_NUMBER_PATTERN}
            title={MOBILE_NUMBER_HELP}
            placeholder="09XXXXXXXXX"
            defaultValue={d?.mobileNumber}
          />
          <Field label="Email" name="email" type="email" defaultValue={d?.email ?? undefined} />
          <Field
            label="Facebook Messenger name"
            name="facebookMessengerName"
            defaultValue={d?.facebookMessengerName ?? undefined}
          />
        </div>
      </Section>

      <Section title="Church">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Service attending"
            name="serviceAttending"
            options={serviceOptions}
            // Only one choice (e.g. a 6PM user): pre-select it
            defaultValue={d?.serviceAttending ?? (serviceOptions.length === 1 ? serviceOptions[0] : undefined)}
            required
          />
          <VglAutocomplete options={vglOptions} defaultId={d?.vglId} defaultName={d?.vglName} />
        </div>
        <CheckboxGroup
          label="Ministry"
          name="ministries"
          options={MINISTRY_OPTIONS}
          defaultValues={d?.ministries ?? []}
          renderLabel={(ministry) => <MinistryName ministry={ministry} />}
          required
        />
        <CheckboxGroup
          label="Discipleship journey completed"
          name="discipleshipJourneyCompleted"
          options={DISCIPLESHIP_JOURNEY_STEPS}
          defaultValues={completedSteps}
        />
      </Section>

      {showActive && (
        <Section title="Status">
          <input type="hidden" name="isActiveShown" value="1" />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="isActive" defaultChecked={d?.isActive ?? true} className="h-4 w-4 accent-stm-navy" />
            Active — inactive members are hidden from check-in
          </label>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{title}</legend>
      {children}
    </fieldset>
  );
}

function CheckboxGroup({
  label,
  name,
  options,
  defaultValues,
  renderLabel = (option) => option,
  required,
}: {
  label: string;
  name: string;
  options: readonly string[];
  defaultValues: string[];
  renderLabel?: (option: string) => React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <p className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 cursor-pointer has-[:checked]:border-stm-navy has-[:checked]:bg-stm-navy/5 has-[:checked]:text-stm-navy"
          >
            <input
              type="checkbox"
              name={name}
              value={option}
              defaultChecked={defaultValues.includes(option)}
              className="h-4 w-4 accent-stm-navy"
            />
            {renderLabel(option)}
          </label>
        ))}
      </div>
    </div>
  );
}
