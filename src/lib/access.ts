import { cache } from "react";
import { redirect } from "next/navigation";
import { eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, members, users } from "@/db/schema";
import { getSession, type Role } from "@/lib/auth";
import { SERVICE_GROUPS, SERVICE_OPTIONS, isServiceGroup, type ServiceGroup } from "@/lib/constants";

/**
 * Who is signed in and what they may see. Role and service group are read from the
 * database on every request (not trusted from the session cookie), so changing or
 * removing a user's access takes effect immediately rather than when their 12h session ends.
 *
 * - serviceGroup null → every service; set → only that group's services (members,
 *   check-in, attendance, import are all filtered).
 * - admin → can add/edit/import members (within their services). An admin with no
 *   group is a super admin and also manages staff users.
 */
export interface Viewer {
  userId: number;
  username: string;
  name: string;
  role: Role;
  serviceGroup: ServiceGroup | null;
  /** Services this user may see and check in to. */
  services: readonly string[];
  canManageMembers: boolean;
  isSuperAdmin: boolean;
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getSession();
  if (!session) return null;
  const [user] = await db
    .select({ id: users.id, username: users.username, name: users.name, role: users.role, serviceGroup: users.serviceGroup })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return null; // deleted since signing in

  const role: Role = user.role === "admin" ? "admin" : "volunteer";
  const serviceGroup = isServiceGroup(user.serviceGroup) ? user.serviceGroup : null;
  return {
    userId: user.id,
    username: user.username,
    name: user.name,
    role,
    serviceGroup,
    services: serviceGroup ? SERVICE_GROUPS[serviceGroup] : SERVICE_OPTIONS,
    canManageMembers: role === "admin",
    isSuperAdmin: role === "admin" && serviceGroup === null,
  };
});

/** Any signed-in user; otherwise to /login. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** Admins (any group) — adding, editing, importing members. Volunteers go back to /. */
export async function requireMemberManager(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.canManageMembers) redirect("/");
  return viewer;
}

/** Admins with no service group — managing staff users. */
export async function requireSuperAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isSuperAdmin) redirect("/");
  return viewer;
}

export function canSeeService(viewer: Viewer, service: string | null | undefined): boolean {
  return !!service && viewer.services.includes(service);
}

/** WHERE condition limiting members to the viewer's services (undefined = no limit). */
export function memberScope(viewer: Viewer): SQL | undefined {
  return viewer.serviceGroup ? inArray(members.serviceAttending, [...viewer.services]) : undefined;
}

/** WHERE condition limiting check-ins to the viewer's services (undefined = no limit). */
export function checkInScope(viewer: Viewer): SQL | undefined {
  return viewer.serviceGroup ? inArray(checkIns.service, [...viewer.services]) : undefined;
}
