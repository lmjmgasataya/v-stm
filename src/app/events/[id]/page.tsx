import Link from "next/link";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { memberScope, requireViewer } from "@/lib/access";
import { formatDateString, manilaDateString } from "@/lib/date";
import { getEventCheckIns, getEventOrNotFound } from "@/lib/events";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { secondaryBtnCls } from "@/components/form";
import type { RosterMember } from "@/app/check-in/CheckInWorkspace";
import { EventCheckInWorkspace } from "./EventCheckInWorkspace";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const event = await getEventOrNotFound((await params).id);

  const checkIns = await getEventCheckIns(event.id, viewer);
  const checkedInIds = checkIns.map((c) => c.memberId);
  // Any active member within the viewer's services — events aren't tied to a service time —
  // plus anyone already checked in (even if since made inactive), so the list matches the count
  const roster = await db
    .select({
      id: members.id,
      lastName: members.lastName,
      firstName: members.firstName,
      middleInitial: members.middleInitial,
      nickname: members.nickname,
      mobileNumber: members.mobileNumber,
      serviceAttending: members.serviceAttending,
      vglName: members.vglName,
      ministries: members.ministries,
    })
    .from(members)
    .where(
      and(
        checkedInIds.length ? or(eq(members.isActive, true), inArray(members.id, checkedInIds)) : eq(members.isActive, true),
        memberScope(viewer)
      )
    )
    .orderBy(asc(members.lastName), asc(members.firstName));

  const today = manilaDateString();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Breadcrumbs items={[{ label: "Events", href: "/events" }, { label: event.name }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">{event.name}</h1>
            <p className="text-sm text-stone-500">{formatDateString(event.eventDate)}</p>
            {event.notes && <p className="text-sm text-stone-600 mt-1 whitespace-pre-line">{event.notes}</p>}
          </div>
          {viewer.canManageMembers && (
            <Link href={`/events/${event.id}/edit`} className={secondaryBtnCls}>
              Edit event
            </Link>
          )}
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
        scopeLabel={viewer.serviceGroup}
        roster={roster satisfies RosterMember[]}
        checkIns={checkIns.map((c) => ({ memberId: c.memberId, checkedInAt: c.checkedInAt.toISOString() }))}
      />
    </div>
  );
}
