import { requireMemberManager } from "@/lib/access";
import { manilaDateString } from "@/lib/date";
import { getEventOrNotFound } from "@/lib/events";
import { EventForm } from "../../EventForm";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMemberManager();
  const event = await getEventOrNotFound((await params).id);
  return (
<EventForm event={event} defaultDate={manilaDateString()} canDelete={viewer.isSuperAdmin} />
  );
}
