import "dotenv/config";
import readXlsxFile from "read-excel-file/node";
import { and, eq, inArray } from "drizzle-orm";
import { db } from ".";
import { eventRegistrations, events, leaders, members, staff } from "./schema";
import { SERVICE_ATTENDING_BY_GROUP, type Ministry, type ServiceGroup } from "@/lib/constants";
import { splitMiddleInitial } from "@/lib/member-import";

// One-off import of "Final Masterlist-STM&Leaders Appreciation Night 2026.xlsx":
//   - STMs (AM / PM / 6PM / La Paz sheets) → stm_members, with "Submitted the Service Team
//     Members Profile?" → profileSubmitted
//   - Leaders 2026 + ENC sheets → stm_leaders (isEnc for the ENC sheet)
//   - Pastors & Staff → stm_staff
//   - the three appreciation night events (pre-registration on), and everyone's
//     "I will attend" answer for their event → stm_event_registrations
//
// Safe to re-run: people already in the database are matched by name (members: name +
// blank mobile, like the app's import) and not duplicated; the three events' registrations
// are replaced with the file's.
//
//   npx tsx --env-file=.env.local src/db/import-appreciation-night.ts "<file.xlsx>" [--dry-run]

type EventKey = "AM" | "PM" | "LAPAZ";

const EVENTS: Record<EventKey, { name: string; eventDate: string }> = {
  AM: { name: "AM SERVICE TEAM MEMBERS AND LEADERS APPRECIATION NIGHT", eventDate: "2026-11-20" },
  PM: { name: "PM and 6PM SERVICE TEAM MEMBERS AND LEADERS APPRECIATION NIGHT", eventDate: "2026-11-27" },
  LAPAZ: { name: "LAPAZ SERVICE TEAM MEMBERS AND LEADERS APPRECIATION NIGHT", eventDate: "2026-12-04" },
};

const STM_SHEETS: { sheet: string; group: ServiceGroup; event: EventKey }[] = [
  { sheet: "AM Services", group: "9AM & 11AM", event: "AM" },
  { sheet: "PM Services", group: "2PM & 4PM", event: "PM" },
  { sheet: "6PM Service", group: "6PM", event: "PM" },
  { sheet: "La Paz Service", group: "10AM & 1PM", event: "LAPAZ" },
];

const MINISTRIES: Record<string, Ministry> = {
  ADMIN: "Admin",
  COMMS: "Communication",
  KIDS: "Kids",
  MUSIC: "Music",
  PRAYER: "Prayer",
  PRODUCTION: "Production",
  PROD: "Production",
  TECH: "Tech",
  USHERING: "Usher",
};

// Corrections to the masterlist (confirmed with the team), keyed "last|first" in lowercase
/** Listed on more than one STM sheet but belongs to this group only (and only its event) */
const STM_GROUP_OVERRIDES: Record<string, ServiceGroup> = { "amistoso|jenny": "2PM & 4PM" };
/** On an STM sheet but is pastor/staff (listed there under a longer name) — not imported as an STM */
const NOT_STMS = new Set(["ado|quincy"]);

/** The masterlist's SERVICES column on the leader sheets */
const LEADER_GROUPS: Record<string, { group: ServiceGroup; event: EventKey }> = {
  AM: { group: "9AM & 11AM", event: "AM" },
  PM: { group: "2PM & 4PM", event: "PM" },
  "6PM": { group: "6PM", event: "PM" },
  "LA PAZ": { group: "10AM & 1PM", event: "LAPAZ" },
};

type Cell = string | number | boolean | Date | null;

const text = (c: Cell | undefined) => (c === null || c === undefined ? "" : String(c).trim().replace(/\s+/g, " "));
const yesNo = (c: Cell | undefined): boolean | null => {
  const v = text(c).toUpperCase();
  return v.startsWith("YES") ? true : v.startsWith("NO") ? false : null;
};

// Two-letter words that are real words/surnames rather than initials ("MA JASMIN", "GO")
const TWO_LETTER_WORDS = new Set(["MA", "DE", "DI", "DA", "LA", "LE", "GO", "NG", "YU", "DY", "SY"]);

/** "DELA CRUZ" → "Dela Cruz", "BELA-ONG" → "Bela-Ong", "PASTOR'S WIFE" → "Pastor's Wife"; "AJ", "MC" stay as initials */
function titleCase(s: string): string {
  return s
    .split(" ")
    .map((word) =>
      /^\p{L}{2}$/u.test(word) && !TWO_LETTER_WORDS.has(word.toUpperCase())
        ? word.toUpperCase()
        : word.toLowerCase().replace(/(^|[\-("])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    )
    .join(" ");
}

/** "MARK LESTER (MIKO)" → Mark Lester + nickname Miko; JUN "BUYCO" → Jun + Buyco; "STEPHEN D" → Stephen + D */
function parseFirstName(raw: string) {
  let first = raw;
  let nickname: string | null = null;
  const nick = /\s*[("]([^)"]+)[)"]\s*/.exec(first);
  if (nick) {
    nickname = titleCase(nick[1].trim());
    first = (first.slice(0, nick.index) + " " + first.slice(nick.index + nick[0].length)).trim();
  }
  const { firstName, middleInitial } = splitMiddleInitial(titleCase(first));
  return { firstName, middleInitial, nickname };
}

const personKey = (last: string, first: string) => `${last.toLowerCase()}|${first.toLowerCase()}`;

/** Rows below the header row (the one with "LAST NAME"), as cells. */
function bodyOf(data: Cell[][]): { header: string[]; rows: Cell[][] } {
  const at = data.findIndex((r) => r.some((c) => text(c).toUpperCase() === "LAST NAME"));
  if (at < 0) throw new Error("No LAST NAME header row");
  return { header: data[at].map((c) => text(c).toUpperCase()), rows: data.slice(at + 1) };
}

async function main() {
  const file = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!file) throw new Error("Usage: import-appreciation-night.ts <file.xlsx> [--dry-run]");

  const sheets = new Map((await readXlsxFile(file)).map((s) => [s.sheet, s.data as Cell[][]]));
  const sheet = (name: string) => {
    const data = sheets.get(name);
    if (!data) throw new Error(`Sheet "${name}" not found`);
    return bodyOf(data);
  };
  const warnings: string[] = [];

  // ---- STMs
  interface StmRow {
    lastName: string;
    firstName: string;
    middleInitial: string;
    nickname: string | null;
    serviceAttending: string;
    ministries: Ministry[];
    profileSubmitted: boolean | null;
    rsvp: { event: EventKey; attending: boolean }[];
  }
  const stms = new Map<string, StmRow>();
  for (const cfg of STM_SHEETS) {
    const { header, rows } = sheet(cfg.sheet);
    const col = (name: string) => header.indexOf(name);
    const [cLast, cFirst, cMinistry] = [col("LAST NAME"), col("FIRST NAME"), col("MINISTRY")];
    const cAttend = header.findIndex((h) => h.startsWith("I WILL ATTEND"));
    // The 6PM and La Paz sheets have the profile answers in the next column, with no header
    const cProfile = cAttend + 1;
    for (const r of rows) {
      const last = text(r[cLast]);
      const first = text(r[cFirst]);
      const attending = yesNo(r[cAttend]);
      if (!last || !first || attending === null) continue; // blank and summary rows
      const ministry = MINISTRIES[text(r[cMinistry]).toUpperCase()];
      if (!ministry) warnings.push(`${cfg.sheet}: ${last}, ${first} — ministry "${text(r[cMinistry])}" not recognized`);
      const name = parseFirstName(first);
      const lastName = titleCase(last);
      const key = personKey(lastName, name.firstName);
      if (NOT_STMS.has(key)) continue;
      const override = STM_GROUP_OVERRIDES[key];
      if (override && override !== cfg.group) continue; // the other sheet's listing is the wrong one
      const existing = stms.get(key);
      const profileSubmitted = yesNo(r[cProfile]);
      if (existing) {
        // Listed on two sheets (serves two service groups): one member, invited to both events
        warnings.push(`${lastName}, ${name.firstName} is on more than one sheet — kept as ${existing.serviceAttending}`);
        if (ministry && !existing.ministries.includes(ministry)) existing.ministries.push(ministry);
        existing.profileSubmitted = existing.profileSubmitted || profileSubmitted;
        if (!existing.rsvp.some((x) => x.event === cfg.event)) existing.rsvp.push({ event: cfg.event, attending });
        continue;
      }
      stms.set(key, {
        lastName,
        ...name,
        serviceAttending: SERVICE_ATTENDING_BY_GROUP[cfg.group],
        ministries: ministry ? [ministry] : [],
        profileSubmitted,
        rsvp: [{ event: cfg.event, attending }],
      });
    }
  }

  // ---- Leaders (no serve teams) and ENC
  interface LeaderRow {
    lastName: string;
    firstName: string;
    nickname: string | null;
    serviceGroup: ServiceGroup | null;
    isEnc: boolean;
    vgLeaderName: string | null;
    rsvp: { event: EventKey; attending: boolean }[];
  }
  const leaderRows = new Map<string, LeaderRow>();
  for (const [sheetName, isEnc] of [
    ["Leaders 2026", false],
    ["ENC", true],
  ] as const) {
    const { header, rows } = sheet(sheetName);
    const col = (name: string) => header.indexOf(name);
    const cAttend = header.findIndex((h) => h.startsWith("I WILL ATTEND") || h.startsWith("I WIL ATTEND"));
    const cVgl = col("VG LEADER");
    for (const r of rows) {
      const last = text(r[col("LAST NAME")]);
      const first = text(r[col("FIRST NAME")]);
      const attending = yesNo(r[cAttend]);
      if (!last || !first || attending === null) continue;
      const service = text(r[col("SERVICES")]).toUpperCase();
      const where = LEADER_GROUPS[service];
      if (!where) warnings.push(`${sheetName}: ${last}, ${first} — service "${service}" not recognized; not invited to an event`);
      const name = parseFirstName(first);
      const lastName = titleCase(last);
      const key = personKey(lastName, name.firstName);
      if (leaderRows.has(key)) {
        warnings.push(`${sheetName}: ${lastName}, ${name.firstName} listed twice — kept the first`);
        continue;
      }
      leaderRows.set(key, {
        lastName,
        firstName: name.middleInitial ? `${name.firstName} ${name.middleInitial}` : name.firstName,
        nickname: name.nickname,
        serviceGroup: where?.group ?? null,
        isEnc,
        vgLeaderName: cVgl >= 0 ? text(r[cVgl]) || null : null,
        rsvp: where ? [{ event: where.event, attending }] : [],
      });
    }
  }

  // ---- Pastors & staff (invited to all three)
  interface StaffRow {
    lastName: string;
    firstName: string;
    nickname: string | null;
    ministry: string;
    rsvp: { event: EventKey; attending: boolean }[];
  }
  const staffRows = new Map<string, StaffRow>();
  {
    const { header, rows } = sheet("Pastors & Staff");
    const col = (name: string) => header.indexOf(name);
    const attendCols: [EventKey, number][] = [
      ["AM", header.findIndex((h) => h.includes("NOV.20"))],
      ["PM", header.findIndex((h) => h.includes("NOV.27"))],
      ["LAPAZ", header.findIndex((h) => h.includes("DEC.4"))],
    ];
    if (attendCols.some(([, i]) => i < 0)) throw new Error("Pastors & Staff: missing an 'I will attend on' column");
    for (const r of rows) {
      const last = text(r[col("LAST NAME")]);
      const first = text(r[col("FIRST NAME")]);
      const rawMinistry = text(r[col("MINISTRY")]);
      if (!first || !rawMinistry) continue;
      const name = parseFirstName(first);
      const lastName = titleCase(last);
      const rsvp = attendCols.flatMap(([event, i]) => {
        const attending = yesNo(r[i]);
        return attending === null ? [] : [{ event, attending }];
      });
      if (rsvp.length === 0) continue; // summary rows
      const ministry = rawMinistry.toUpperCase() === "ENC" ? "ENC" : titleCase(rawMinistry);
      staffRows.set(personKey(lastName, name.firstName), {
        lastName,
        firstName: name.middleInitial ? `${name.firstName} ${name.middleInitial}` : name.firstName,
        nickname: name.nickname,
        ministry,
        rsvp,
      });
    }
  }

  // Same name in two lists (e.g. a pastor's child who also serves) — kept in both, flagged
  const stmNames = new Set(stms.keys());
  for (const [key, l] of leaderRows) if (stmNames.has(key)) warnings.push(`Leader ${l.lastName}, ${l.firstName} is also an STM`);
  for (const [key, s] of staffRows) if (stmNames.has(key)) warnings.push(`Staff ${s.lastName}, ${s.firstName} is also an STM`);

  console.log(`Parsed ${stms.size} STMs, ${leaderRows.size} leaders (${[...leaderRows.values()].filter((l) => l.isEnc).length} ENC), ${staffRows.size} pastors & staff`);
  for (const w of warnings) console.log(`  ! ${w}`);
  if (dryRun) {
    for (const s of stms.values()) console.log(`  STM ${s.lastName}, ${s.firstName}${s.middleInitial ? ` ${s.middleInitial}.` : ""}${s.nickname ? ` (${s.nickname})` : ""} · ${s.ministries.join("+")} · ${s.serviceAttending} · profile=${s.profileSubmitted}`);
    for (const l of leaderRows.values()) console.log(`  LEADER ${l.lastName}, ${l.firstName} · ${l.serviceGroup} · enc=${l.isEnc} · VGL ${l.vgLeaderName}`);
    for (const s of staffRows.values()) console.log(`  STAFF ${s.lastName}, ${s.firstName} · ${s.ministry}`);
    console.log("Dry run — nothing saved.");
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    // ---- Events
    const eventIds = {} as Record<EventKey, number>;
    for (const [key, e] of Object.entries(EVENTS) as [EventKey, (typeof EVENTS)[EventKey]][]) {
      const [found] = await tx
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.name, e.name), eq(events.eventDate, e.eventDate)));
      if (found) {
        await tx.update(events).set({ preRegistration: true }).where(eq(events.id, found.id));
        eventIds[key] = found.id;
      } else {
        const [created] = await tx.insert(events).values({ ...e, preRegistration: true }).returning({ id: events.id });
        eventIds[key] = created.id;
      }
    }

    // ---- People. Existing rows are matched by name and keep their own details (only the
    // profile answer is refreshed for STMs).
    const existingMembers = new Map(
      (await tx.select({ id: members.id, lastName: members.lastName, firstName: members.firstName, mobileNumber: members.mobileNumber }).from(members))
        .filter((m) => m.mobileNumber === "")
        .map((m) => [personKey(m.lastName, m.firstName), m.id])
    );
    const memberIds = new Map<string, number>();
    let newMembers = 0;
    for (const [key, s] of stms) {
      const id = existingMembers.get(key);
      if (id) {
        if (s.profileSubmitted !== null) await tx.update(members).set({ profileSubmitted: s.profileSubmitted }).where(eq(members.id, id));
        memberIds.set(key, id);
        continue;
      }
      const [row] = await tx
        .insert(members)
        .values({
          lastName: s.lastName,
          firstName: s.firstName,
          middleInitial: s.middleInitial,
          nickname: s.nickname,
          serviceAttending: s.serviceAttending,
          ministries: s.ministries,
          profileSubmitted: s.profileSubmitted,
        })
        .returning({ id: members.id });
      memberIds.set(key, row.id);
      newMembers++;
    }

    const existingLeaders = new Map(
      (await tx.select({ id: leaders.id, lastName: leaders.lastName, firstName: leaders.firstName }).from(leaders)).map((l) => [personKey(l.lastName, l.firstName), l.id])
    );
    const leaderIds = new Map<string, number>();
    for (const [key, l] of leaderRows) {
      const { rsvp: _rsvp, ...values } = l;
      let id = existingLeaders.get(personKey(l.lastName, l.firstName));
      if (id) await tx.update(leaders).set(values).where(eq(leaders.id, id));
      else [{ id }] = await tx.insert(leaders).values(values).returning({ id: leaders.id });
      leaderIds.set(key, id);
    }

    const existingStaff = new Map(
      (await tx.select({ id: staff.id, lastName: staff.lastName, firstName: staff.firstName }).from(staff)).map((s) => [personKey(s.lastName, s.firstName), s.id])
    );
    const staffIds = new Map<string, number>();
    for (const [key, s] of staffRows) {
      const { rsvp: _rsvp, ...values } = s;
      let id = existingStaff.get(personKey(s.lastName, s.firstName));
      if (id) await tx.update(staff).set(values).where(eq(staff.id, id));
      else [{ id }] = await tx.insert(staff).values(values).returning({ id: staff.id });
      staffIds.set(key, id);
    }

    // ---- Registrations: replaced wholesale for these three events
    await tx.delete(eventRegistrations).where(inArray(eventRegistrations.eventId, Object.values(eventIds)));
    const regs: (typeof eventRegistrations.$inferInsert)[] = [];
    for (const [key, s] of stms) for (const r of s.rsvp) regs.push({ eventId: eventIds[r.event], memberId: memberIds.get(key)!, attending: r.attending });
    for (const [key, l] of leaderRows) for (const r of l.rsvp) regs.push({ eventId: eventIds[r.event], leaderId: leaderIds.get(key)!, attending: r.attending });
    for (const [key, s] of staffRows) for (const r of s.rsvp) regs.push({ eventId: eventIds[r.event], staffId: staffIds.get(key)!, attending: r.attending });
    for (let i = 0; i < regs.length; i += 500) await tx.insert(eventRegistrations).values(regs.slice(i, i + 500));

    console.log(`✓ ${newMembers} new STMs (${stms.size - newMembers} already in the database), ${leaderRows.size} leaders, ${staffRows.size} pastors & staff`);
    for (const key of Object.keys(EVENTS) as EventKey[]) {
      const forEvent = regs.filter((r) => r.eventId === eventIds[key]);
      console.log(`✓ #${eventIds[key]} ${EVENTS[key].name} (${EVENTS[key].eventDate}): ${forEvent.length} invited, ${forEvent.filter((r) => r.attending).length} will attend`);
    }
  });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
