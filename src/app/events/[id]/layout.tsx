import { requireViewer } from "@/lib/access";
import { formatDateString } from "@/lib/date";
import { getEventOrNotFound } from "@/lib/events";
import { describeAudience } from "@/lib/event-people-shared";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventTabs } from "./EventTabs";

/** Event header + tabs (Check-in, Summary, Pre-registration, Edit event) shared by every event page. */
export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const event = await getEventOrNotFound((await params).id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <div>
          <Breadcrumbs items={[{ label: "Events", href: "/events" }, { label: event.name }]} />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">{event.name}</h1>
          <p className="text-sm text-stone-500">
            {formatDateString(event.eventDate)}
            {event.preRegistration && ` · Pre-registration: ${describeAudience(event)}`}
          </p>
          {event.notes && <p className="text-sm text-stone-600 mt-1 whitespace-pre-line">{event.notes}</p>}
        </div>
        <EventTabs eventId={event.id} canManage={viewer.canManageMembers} />
      </div>
      {children}
    </div>
  );
}
