import { NextResponse, type NextRequest } from "next/server";
import { getTableColumns, sql } from "drizzle-orm";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getViewer } from "@/lib/access";
import { activeMemberCondition, lastServedSql } from "@/lib/activity";
import { manilaDateString } from "@/lib/date";
import { MEMBER_IMPORT_HEADERS } from "@/lib/member-import";
import { getActivityRule } from "@/lib/settings";
import { memberListOrder, memberListWhere, parseMemberListParams } from "../query";

/**
 * Excel export of the members list: every member matching the list's current filters, search
 * and sort (all pages). Admins only — it's a bulk download of personal data.
 */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.canManageMembers) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rule = await getActivityRule();
  const p = parseMemberListParams(req.nextUrl.searchParams, viewer);
  const rows = await db
    .select({
      ...getTableColumns(members),
      lastServed: lastServedSql,
      // "Active" exactly as the list means it (activity rule when on, else the roster flag)
      active: sql<boolean>`${activeMemberCondition(rule)}`,
    })
    .from(members)
    .where(memberListWhere(p, viewer, rule))
    .orderBy(...memberListOrder(p));

  // The first columns are exactly the import template's, so an export can be edited and
  // re-imported; the extra columns at the end are ignored by the import.
  const header = [...MEMBER_IMPORT_HEADERS, "Status", "Last Served", "Added"];
  const data = rows.map((m) => [
    m.lastName,
    m.firstName,
    m.middleInitial,
    m.nickname,
    m.mobileNumber,
    m.facebookMessengerName,
    m.lifestage,
    m.age,
    m.gender,
    m.serviceAttending,
    m.email,
    m.vglName,
    (m.discipleshipJourneyCompleted ?? "").split(",").filter(Boolean).join("; "),
    m.ministries.join("; "),
    m.active ? "Active" : "Inactive",
    m.lastServed,
    manilaDateString(m.createdAt),
  ]);

  const sheet: SheetData = [
    header.map((value) => ({ value, fontWeight: "bold" as const })),
    ...data.map((row) =>
      row.map((value) => {
        if (value === null || value === "") return null;
        if (typeof value === "number") return { value, type: Number };
        // "@" = Text, so Excel keeps mobile numbers' leading 0 and doesn't reformat dates
        return { value: String(value), format: "@" };
      })
    ),
  ];
  const buffer = await writeXlsxFile(sheet, {
    sheet: "Service team members",
    stickyRowsCount: 1,
    columns: header.map((h) => ({ width: ["Discipleship Journey Completed", "Ministry", "Email"].includes(h) ? 32 : 18 })),
  }).toBuffer();

  const filename = `service-team-members-${manilaDateString()}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
