import Link from "next/link";
import { requireMemberManager } from "@/lib/access";
import { formatDateString } from "@/lib/date";
import { getEventOrNotFound } from "@/lib/events";
import { getEventPersonCheckIns, getEventRoster } from "@/lib/event-people";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { secondaryBtnCls } from "@/components/form";
import { RegistrationEditor } from "./RegistrationEditor";

export default async function EventRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMemberManager();
  const event = await getEventOrNotFound((await params).id);
  const checkIns = await getEventPersonCheckIns(event.id);
  const people = await getEventRoster(event.id, new Set(checkIns.map((c) => c.key)));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Breadcrumbs
          items={[{ label: "Events", href: "/events" }, { label: event.name, href: `/events/${event.id}` }, { label: "Pre-registration" }]}
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Pre-registration</h1>
            <p className="text-sm text-stone-500">
              {event.name} · {formatDateString(event.eventDate)}
            </p>
          </div>
          <Link href={`/events/${event.id}`} className={secondaryBtnCls}>
            Back to check-in
          </Link>
        </div>
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

      <RegistrationEditor eventId={event.id} people={people} checkIns={checkIns} />
    </div>
  );
}
