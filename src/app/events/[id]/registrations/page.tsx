import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMemberManager } from "@/lib/access";
import { getEventOrNotFound } from "@/lib/events";
import { getEventPersonCheckIns, getEventRoster } from "@/lib/event-people";
import { describeAudience, inAudience } from "@/lib/event-people-shared";
import { RegistrationEditor } from "./RegistrationEditor";

export default async function EventRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMemberManager();
  const event = await getEventOrNotFound((await params).id);
  // Only for events with pre-registration on (Edit event); the tab is hidden otherwise
  if (!event.preRegistration) redirect(`/events/${event.id}`);
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
      </div>

      <RegistrationEditor eventId={event.id} people={people} outside={outside} checkIns={checkIns} />
    </div>
  );
}
