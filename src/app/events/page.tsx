import Link from "next/link";
import { requireViewer } from "@/lib/access";
import { formatDateString, manilaDateString } from "@/lib/date";
import { getEventsWithCounts, type EventSummary } from "@/lib/events";
import { primaryBtnCls } from "@/components/form";

export default async function EventsPage() {
  const viewer = await requireViewer();
  const { upcoming, past } = await getEventsWithCounts(viewer);
  const today = manilaDateString();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Events</h1>
          <p className="text-sm text-stone-500">Gatherings outside the usual services — check in any service team member.</p>
        </div>
        {viewer.canManageMembers && (
          <Link href="/events/new" className={primaryBtnCls}>
            + New event
          </Link>
        )}
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <p className="text-stone-600 font-medium">No events yet</p>
          <p className="text-sm text-stone-400 mt-1">
            {viewer.canManageMembers ? "Create one for a weekday gathering, training or outreach." : "An admin can create one."}
          </p>
        </div>
      ) : (
        <>
          <EventSection title="Today & upcoming" items={upcoming} today={today} empty="Nothing scheduled." />
          <EventSection title="Past" items={past} today={today} empty="No past events." />
        </>
      )}
    </div>
  );
}

function EventSection({ title, items, today, empty }: { title: string; items: EventSummary[]; today: string; empty: string }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-stone-400">{empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-5 hover:border-stm-brand/40 hover:shadow-sm transition flex flex-col gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-stone-900">{event.name}</h3>
                  {event.eventDate === today && (
                    <span className="shrink-0 rounded-full bg-stm-green/10 px-2 py-0.5 text-xs font-semibold text-stm-green">Today</span>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-1">{formatDateString(event.eventDate)}</p>
                {event.notes && <p className="text-xs text-stone-400 mt-1 line-clamp-2">{event.notes}</p>}
              </div>
              <p className="text-sm">
                <span className="font-bold text-stm-green">{event.checkedIn}</span> <span className="text-stone-500">checked in</span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
