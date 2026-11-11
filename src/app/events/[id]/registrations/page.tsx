import Link from "next/link";
import { requireMemberManager } from "@/lib/access";
import { getEventOrNotFound } from "@/lib/events";
import { getEventPersonCheckIns, getEventRoster } from "@/lib/event-people";
import { describeAudience, inAudience } from "@/lib/event-people-shared";
import { RegistrationEditor } from "./RegistrationEditor";

export default async function EventRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMemberManager();
  const event = await getEventOrNotFound((await params).id);
  const checkIns = await getEventPersonCheckIns(event.id);
  const roster = await getEventRoster(event.id, new Set(checkIns.map((c) => c.key)));
  // Only the people this event invites — plus anyone already marked Yes/No who no longer fits
  // (e.g. after changing who's invited), so they can still be seen and taken off the list
  const people = roster.filter((p) => inAudience(p, event) || p.registered !== null);
  const outside = people.filter((p) => !inAudience(p, event)).map((p) => p.key);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-stone-500">
          Invites: <span className="font-medium text-stone-700">{describeAudience(event)}</span>
          {" · "}
          <Link href={`/events/${event.id}/edit`} className="text-stm-brand hover:underline">
            Change
          </Link>
        </p>
        {!event.preRegistration && (
          <p className="mt-3 rounded-lg border border-stm-amber/40 bg-stm-amber/10 px-3 py-2 text-sm text-stone-700">
            Pre-registration is off for this event, so check-in doesn&apos;t use this list yet.{" "}
            <Link href={`/events/${event.id}/edit`} className="font-semibold text-stm-brand underline">
              Turn it on
            </Link>{" "}
            to check in only the people marked Yes and tag everyone else as a walk-in.
          </p>
        )}
      </div>

      <RegistrationEditor eventId={event.id} people={people} outside={outside} checkIns={checkIns} />
    </div>
  );
}
