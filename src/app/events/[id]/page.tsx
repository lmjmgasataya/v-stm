import Link from "next/link";
import { requireViewer } from "@/lib/access";
import { formatDateString, manilaDateString } from "@/lib/date";
import { getEventOrNotFound } from "@/lib/events";
import { getEventPersonCheckIns, getEventRoster } from "@/lib/event-people";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { secondaryBtnCls } from "@/components/form";
import { EventCheckInWorkspace } from "./EventCheckInWorkspace";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const event = await getEventOrNotFound((await params).id);

  const checkIns = await getEventPersonCheckIns(event.id);
  // Every active STM, leader and pastor/staff — events aren't tied to a service time or to the
  // viewer's service group — plus anyone already checked in (even if since made inactive)
  const people = await getEventRoster(event.id, new Set(checkIns.map((c) => c.key)));

  const today = manilaDateString();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Breadcrumbs items={[{ label: "Events", href: "/events" }, { label: event.name }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">{event.name}</h1>
            <p className="text-sm text-stone-500">
              {formatDateString(event.eventDate)}
              {event.preRegistration && " · Pre-registration"}
            </p>
            {event.notes && <p className="text-sm text-stone-600 mt-1 whitespace-pre-line">{event.notes}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/events/${event.id}/summary`} className={secondaryBtnCls}>
              Summary
            </Link>
            {viewer.canManageMembers && (
              <>
                <Link href={`/events/${event.id}/registrations`} className={secondaryBtnCls}>
                  Pre-registration
                </Link>
                <Link href={`/events/${event.id}/edit`} className={secondaryBtnCls}>
                  Edit event
                </Link>
              </>
            )}
          </div>
        </div>
        {event.eventDate !== today && (
          <p className="mt-3 rounded-lg border border-stm-amber/40 bg-stm-amber/10 px-3 py-2 text-sm text-stone-700">
            This event is {event.eventDate > today ? "on a later date" : "in the past"} — check-ins here are still recorded for this
            event.
          </p>
        )}
      </div>

      <EventCheckInWorkspace
        eventId={event.id}
        preRegistration={event.preRegistration}
        people={people}
        checkIns={checkIns}
      />
    </div>
  );
}
