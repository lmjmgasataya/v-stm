import { requireViewer } from "@/lib/access";
import { manilaDateString } from "@/lib/date";
import { getEventOrNotFound } from "@/lib/events";
import { getEventPersonCheckIns, getEventRoster } from "@/lib/event-people";
import { EventCheckInWorkspace } from "./EventCheckInWorkspace";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireViewer();
  const event = await getEventOrNotFound((await params).id);

  const checkIns = await getEventPersonCheckIns(event.id);
  // Every active STM, leader and pastor/staff — events aren't tied to a service time or to the
  // viewer's service group — plus anyone already checked in (even if since made inactive)
  const people = await getEventRoster(event.id, new Set(checkIns.map((c) => c.key)));

  const today = manilaDateString();

  return (
    <div className="flex flex-col gap-5">
      {event.eventDate < today && (
        <p className="rounded-lg border border-stm-amber/40 bg-stm-amber/10 px-3 py-2 text-sm text-stone-700">
          This event is in the past — check-ins here are still recorded for this event.
        </p>
      )}

      <EventCheckInWorkspace
        eventId={event.id}
        preRegistration={event.preRegistration}
        people={people}
        checkIns={checkIns}
      />
    </div>
  );
}
