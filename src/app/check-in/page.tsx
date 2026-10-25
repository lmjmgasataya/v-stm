import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, members } from "@/db/schema";
import { checkInScope, memberScope, requireViewer } from "@/lib/access";
import { SERVICE_GROUPS, SERVICE_GROUP_NAMES, groupOfService, isServiceGroup } from "@/lib/constants";
import { formatDateString, manilaDateString } from "@/lib/date";
import { CheckInWorkspace, type RosterMember, type TodayCheckIn } from "./CheckInWorkspace";

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; service?: string }>;
}) {
  const viewer = await requireViewer();
  const sp = await searchParams;

  // A service-group user only ever has their own group
  const groups = viewer.serviceGroup ? [viewer.serviceGroup] : SERVICE_GROUP_NAMES;
  // ?service= (dashboard links) picks that service's group
  const requested = isServiceGroup(sp.group) ? sp.group : sp.service ? groupOfService(sp.service) : undefined;
  const initialGroup = requested && groups.includes(requested) ? requested : groups[0];
  const today = manilaDateString();

  const [roster, todays] = await Promise.all([
    db
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
      .where(and(eq(members.isActive, true), memberScope(viewer)))
      .orderBy(asc(members.lastName), asc(members.firstName)),
    db
      .select({ memberId: checkIns.memberId, service: checkIns.service, checkedInAt: checkIns.checkedInAt })
      .from(checkIns)
      .where(and(eq(checkIns.serviceDate, today), checkInScope(viewer))),
  ]);

  return (
    <CheckInWorkspace
      // Remount when the day rolls over so optimistic state from yesterday doesn't linger
      key={today}
      groups={groups.map((name) => ({ name, services: [...SERVICE_GROUPS[name]] }))}
      initialGroup={initialGroup}
      scoped={!!viewer.serviceGroup}
      todayLabel={formatDateString(today)}
      roster={roster satisfies RosterMember[]}
      checkIns={todays.map((c) => ({ ...c, checkedInAt: c.checkedInAt.toISOString() })) satisfies TodayCheckIn[]}
    />
  );
}
