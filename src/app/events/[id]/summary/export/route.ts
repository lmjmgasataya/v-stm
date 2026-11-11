import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import writeXlsxFile, { type Cell, type Row, type SheetData } from "write-excel-file/node";
import { db } from "@/db";
import { events } from "@/db/schema";
import { getViewer } from "@/lib/access";
import { formatDateString } from "@/lib/date";
import { getEventSummary, type SummaryCounts } from "@/lib/event-people";
import { describeAudience } from "@/lib/event-people-shared";
import { SUMMARY_GROUP_LABELS, TINT_HEX, summaryColumns, type SummaryColumn } from "@/lib/event-summary-columns";

const HEADER_BG = "#F5F5F4";
const SECTION_TEXT = "#0F766E"; // stm-brand

/** Excel download of an event's summary — the same table as the Summary tab, colors included. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  const [event] = Number.isInteger(id) ? await db.select().from(events).where(eq(events.id, id)).limit(1) : [];
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { sections, grandTotal, byService } = await getEventSummary(event.id);
  const columns = summaryColumns(event.preRegistration);
  const width = columns.length + 1;

  const bold = (value: string): Cell => ({ value, fontWeight: "bold" });
  /** A value cell in its column's colors; `strong` = subtotal / total rows */
  const valueCell = (c: SummaryColumn, value: number, strong = false): Cell => {
    const tint = c.tint ? TINT_HEX[c.tint] : undefined;
    return {
      value,
      type: Number,
      align: "right",
      ...(tint ? { backgroundColor: tint.bg, textColor: tint.text } : {}),
      ...(strong || c.tint === "total" ? { fontWeight: "bold" as const } : {}),
      // Divider before the total column and at the start of "At the door"
      ...(isGroupStart(c, columns) ? { leftBorderStyle: "medium" as const, leftBorderColor: "#D6D3D1" } : {}),
    };
  };
  const countsRow = (label: Cell, counts: SummaryCounts, strong = false): Row => [
    label,
    ...columns.map((c) => valueCell(c, counts[c.key], strong)),
  ];
  const headerCell = (c: SummaryColumn): Cell => {
    const tint = c.tint ? TINT_HEX[c.tint] : undefined;
    return {
      value: c.label,
      fontWeight: "bold",
      align: "right",
      backgroundColor: tint?.bg ?? HEADER_BG,
      textColor: tint?.text,
      bottomBorderStyle: "thin",
      ...(isGroupStart(c, columns) ? { leftBorderStyle: "medium" as const, leftBorderColor: "#D6D3D1" } : {}),
    };
  };
  /** A cell spanning the whole table width (title, section and note rows) */
  const wide = (cell: Cell): Row => [{ ...cell, columnSpan: width }, ...Array<null>(width - 1).fill(null)];

  const sheet: SheetData = [
    wide({ value: event.name, fontWeight: "bold", fontSize: 14 }),
    wide({ value: `${formatDateString(event.eventDate)}${event.preRegistration ? ` · Invites: ${describeAudience(event)}` : ""}` }),
    [],
  ];

  // RSVP / At the door over their columns
  if (event.preRegistration) {
    const groupRow: Row = [{ value: "", backgroundColor: HEADER_BG }];
    columns.forEach((c, i) => {
      if (i > 0 && columns[i - 1].group === c.group) return void groupRow.push(null);
      const span = columns.slice(i).findIndex((x) => x.group !== c.group);
      groupRow.push({
        value: SUMMARY_GROUP_LABELS[c.group].toUpperCase(),
        fontWeight: "bold",
        align: "center",
        backgroundColor: HEADER_BG,
        columnSpan: span === -1 ? columns.length - i : span,
        ...(i > 0 ? { leftBorderStyle: "medium" as const, leftBorderColor: "#D6D3D1" } : {}),
      });
    });
    sheet.push(groupRow);
  }
  sheet.push([{ value: "Group", fontWeight: "bold", backgroundColor: HEADER_BG, bottomBorderStyle: "thin" }, ...columns.map(headerCell)]);

  for (const section of sections) {
    sheet.push(wide({ value: section.title.toUpperCase(), fontWeight: "bold", textColor: SECTION_TEXT }));
    for (const row of section.rows) sheet.push(countsRow({ value: row.label, indent: 1 }, row));
    if (section.rows.length > 1) sheet.push(countsRow(bold("Subtotal"), section.total, true));
  }
  sheet.push(countsRow({ value: "Grand total", fontWeight: "bold", topBorderStyle: "medium" }, grandTotal, true));

  if (byService) {
    const perGroup = event.preRegistration ? 2 : 1;
    sheet.push([], [bold("STMs by service")]);
    sheet.push([
      bold("Ministry"),
      ...byService.groups.flatMap((g) => [
        { value: g, fontWeight: "bold" as const, align: "center" as const, columnSpan: perGroup, backgroundColor: HEADER_BG },
        ...Array<null>(perGroup - 1).fill(null),
      ]),
    ]);
    sheet.push([
      { value: "" },
      ...byService.groups.flatMap(() => [
        ...(event.preRegistration
          ? [{ value: "Will attend", align: "right" as const, backgroundColor: TINT_HEX.teal.bg, textColor: TINT_HEX.teal.text }]
          : []),
        { value: "Present", fontWeight: "bold" as const, align: "right" as const, backgroundColor: TINT_HEX.total.bg },
      ]),
    ]);
    const serviceCells = (cells: { willAttend: number; present: number }[], strong = false): Cell[] =>
      cells.flatMap((cell) => [
        ...(event.preRegistration
          ? [{ value: cell.willAttend, type: Number, backgroundColor: TINT_HEX.teal.bg, textColor: TINT_HEX.teal.text, ...(strong ? { fontWeight: "bold" as const } : {}) }]
          : []),
        { value: cell.present, type: Number, fontWeight: "bold" as const, backgroundColor: TINT_HEX.total.bg },
      ]);
    for (const row of byService.rows) sheet.push([{ value: row.label }, ...serviceCells(row.cells)]);
    sheet.push([bold("Total"), ...serviceCells(byService.totals, true)]);
  }

  sheet.push(
    [],
    wide({
      value: `${
        event.preRegistration
          ? "Invited = on this event's list. Will attend / won't attend = their RSVP. Checked in = pre-registered people who came; walk-ins = everyone else who was checked in. "
          : ""
      }An STM in more than one ministry counts in each ministry row but once in the subtotals.`,
      wrap: true,
      height: 45,
    })
  );

  const buffer = await writeXlsxFile(sheet, {
    sheet: "Summary",
    columns: [{ width: 26 }, ...columns.map(() => ({ width: 14 }))],
  }).toBuffer();

  const fileName = `${event.name}-${event.eventDate}-summary`.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

/** First column of a group after another group, or the total column — both get a divider */
function isGroupStart(c: SummaryColumn, columns: SummaryColumn[]) {
  const i = columns.indexOf(c);
  return i > 0 && (c.tint === "total" || columns[i - 1].group !== c.group);
}
