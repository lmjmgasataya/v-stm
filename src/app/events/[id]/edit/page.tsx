import { requireMemberManager } from "@/lib/access";
import { manilaDateString } from "@/lib/date";
import { getEventOrNotFound } from "@/lib/events";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventForm } from "../../EventForm";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMemberManager();
  const event = await getEventOrNotFound((await params).id);
  return (
    <div>
      <Breadcrumbs items={[{ label: "Events", href: "/events" }, { label: event.name, href: `/events/${event.id}` }, { label: "Edit" }]} />
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 mb-4">Edit {event.name}</h1>
      <EventForm event={event} defaultDate={manilaDateString()} canDelete={viewer.isSuperAdmin} />
    </div>
  );
}
