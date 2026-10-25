import { requireMemberManager } from "@/lib/access";
import { manilaDateString } from "@/lib/date";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventForm } from "../EventForm";

export default async function NewEventPage() {
  await requireMemberManager();
  return (
    <div>
      <Breadcrumbs items={[{ label: "Events", href: "/events" }, { label: "New event" }]} />
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 mb-4">New event</h1>
      <EventForm defaultDate={manilaDateString()} />
    </div>
  );
}
