# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Run `nvm use 24` before any `npm` command.

```bash
# Development
npm run dev          # Start dev server (binds 0.0.0.0)
npm run build        # Production build
npm run lint         # ESLint

# Database
npm run db:generate  # Generate Drizzle migration files from schema changes
npm run db:migrate   # Apply pending migrations (uses DATABASE_URL_UNPOOLED)
npm run db:push      # Push schema directly without migration files
npm run db:studio    # Open Drizzle Studio GUI
npm run db:seed      # Create/reset the admin user (SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD, default admin / changeme)
```

There are no tests configured in this project.

### Shared database with v-1 — read before touching the schema

This app **reuses v-1's Supabase database** (as v-4-events does). Every table this app owns is prefixed `stm_`, and `drizzle.config.ts` sets `tablesFilter: ["stm_*"]` so `db:push`/`db:generate` only ever see and change `stm_*` tables — without it, drizzle-kit would try to drop every other app's tables. Migration history is kept in `__stm_drizzle_migrations`.

- New tables **must** be named `stm_<something>`.
- Don't use `pgEnum` — Postgres enums are database-wide, so they aren't covered by `tablesFilter` and can collide with v-1's (`lifestage`, `user_role`, …). Use `text` columns and validate in code.
- The one exception to "don't touch v-1's tables": the VGL autocomplete **reads** v-1's `victory_group_leaders`. It's declared in `src/db/v1.ts` (outside `src/db/schema/`, so drizzle-kit never sees it) with only the columns we read. Never write to it, and don't add a foreign key to it — v-1 merges/deletes leaders.

## Architecture

**Service Team** — database of service team members (STMs) plus per-service check-in. Staff users are tied to a **service group** (`9AM & 11AM`, `2PM & 4PM`, `6PM`, `10AM & 1PM`) and only see that group's members, check-ins and attendance; users with no group see everything. Admins add/edit/import STMs within their services; volunteers only check in. Admins with no group ("super admins") also manage users.

### Stack
- **Next.js 16 App Router** with React 19 — all pages under `src/app/`
- **Drizzle ORM** on PostgreSQL — schema in `src/db/schema/index.ts`, client in `src/db/index.ts`
- **JWT sessions** via `jose` — `src/lib/auth.ts`, stored in the `stm_session` cookie (12h, HS256)
- **Tailwind CSS 4** — custom colors `stm-navy` / `stm-accent` / `stm-green` / `stm-amber` defined via `@theme` in `src/app/globals.css`

### Data model
- `stm_users` — staff accounts: `username`, `passwordHash` (bcryptjs), `name`, `role` (`admin` | `volunteer`), `serviceGroup` (a `SERVICE_GROUPS` key from `src/lib/constants.ts`; null = all services). Managed at `/users`; `db:seed` creates/resets the first super admin.
- `stm_members` — one row per STM: `lastName`, `firstName`, `middleInitial` (`''` when none), `nickname` (shown as "Dela Cruz, Juan P. (Jun)" via `memberDisplayName`; searchable on the list and at check-in), `mobileNumber` (`''` when unknown, never null), `facebookMessengerName`, `lifestage`, `age`, `gender`, `serviceAttending`, `email`, `vglId` + `vglName` (see VGL below), `discipleshipJourneyCompleted` (comma-joined `DISCIPLESHIP_JOURNEY_STEPS`, same format as v-1's `victory_group_leaders`), `ministries` (`text[]` of `MINISTRY_OPTIONS`), `isActive`. Unique index `stm_members_person_uq` on `(lower(lastName), lower(firstName), mobileNumber)` is the dedup rule.
- `stm_check_ins` — `memberId` (cascade delete), `service` (a `SERVICE_OPTIONS` value), `serviceDate` (Manila calendar date, `YYYY-MM-DD`), `checkedInAt`, `checkedInById`. Unique on `(memberId, serviceDate, service)`: one check-in per member per service per day; a member can serve more than one service a day.

### Route sections
- `src/app/page.tsx` — dashboard: active member count, today's check-ins per service (links into check-in), active members per ministry (links into the filtered list)
- `src/app/members/` — list with `?q=` search (name/mobile/email/VGL), `?ministry=`, `?service=`, `?status=inactive|all` (default active only) and `?sort=&dir=`. `new/`, `[id]/edit/` and Import are **admin-only** (`requireAdmin`); `actions.ts` has `createMember` / `updateMember` / `deleteMember`, `importActions.ts` has `previewMemberImport` / `importMembers`. Delete cascades the member's check-ins, so the edit page steers admins to unticking Active instead.
- `src/app/check-in/` — `CheckInWorkspace`: service-group cards (super admins only — group users just get their own group), `?group=` kept in the URL via `history.replaceState` (`?service=` from dashboard links maps to its group). Under it, a "Checking in for" checkbox per service in the group (both ticked by default; at least one stays ticked) — a check-in records every ticked service, e.g. 2PM and 4PM at once. A member counts as done once checked in to all ticked services; a partly checked-in member shows e.g. "Check in 4PM". Each recorded service is a chip with its own undo (×). All the viewer's active members and today's check-ins load once and filter client-side (search, ministry chips). `useOptimistic`, Enter checks in a single match, auto-`router.refresh()` every 20s. `actions.ts`: `checkIn(memberId, services[])` (insert … `onConflictDoNothing`, so repeats keep the first time; rejects services/members outside the viewer's scope) / `undoCheckIn(memberId, service)` (today only).
- `src/app/attendance/` — `?date=YYYY-MM-DD` (default today), `?ministry=` filter, `?sort=last|first|time&dir=asc|desc` (default last name A–Z). The ministry chips double as per-ministry counts (always over the whole day) and as the filter; the filter applies to the stat cards, service lists, recent dates and calendar counts. Every link (`href()` in the page, `keep` on `AttendanceCalendar`) carries the current filter/sort. `AttendanceCalendar` is the date picker: a month grid where days with check-ins are bold with their count (`getCheckInCountsByDate`); ‹ › browse via `?month=YYYY-MM` while keeping the selected date. Queries in `src/lib/attendance.ts`.
- `src/app/users/` — **super admin only** (`requireSuperAdmin`): list, add, edit (name, username, role, service group, optional new password), delete. You can't change your own role/group or delete yourself, so the last super admin can't lock themselves out.
- `src/app/login/` — staff login

### Patterns
**Auth gating and service scope** — `src/lib/access.ts`. `getViewer()` (React `cache`d per request) checks the session cookie, then loads the user's **current** role and service group from `stm_users` — never trust role/group from the JWT, so access changes and deletions apply on the next request. Every page/action starts with `requireViewer()` / `requireMemberManager()` (admins) / `requireSuperAdmin()`. Scope every query to `viewer.services`: `memberScope(viewer)` / `checkInScope(viewer)` WHERE conditions, `canSeeService(viewer, s)`, and the attendance queries take `services`. Member forms only offer `viewer.services` (`validateMemberInput(input, services)`); edit/delete outside scope behave as not found. The import requires every row's service to be one of the user's (blank → their only service when the group has one). `src/proxy.ts` additionally guards `/`, `/members/*`, `/check-in/*`, `/attendance/*`, `/users/*`.

**Mutations use Server Actions**, not API routes. The only route handler is `api/health`.

**Shared member fields/validation** — `src/components/MemberFields.tsx` (inputs, used by the add and edit forms) and `src/lib/members.ts` (`readMemberInput` / `validateMemberInput` / `toMemberValues`). When adding a member field, change these once.

**Forms keep their values on error** — React resets a `<form action>` after every submission, failed validation included. The member forms submit through `submitKeepingValues(dispatch)` (`src/components/submitKeepingValues.ts`) as `onSubmit` instead, and reset manually on success (e.g. "Save & add another").

**VGL autocomplete** — `getVglOptions()` (`src/lib/vgl.ts`) loads v-1's active, non-deleted leaders once per form; `VglAutocomplete` filters them client-side. Picking one posts `vglId`; typing without picking posts only `vglName` (free text, flagged with `*` in the list). On save, `resolveVgl` re-checks a picked id against v-1 and takes the name from there, falling back to free text if the leader is gone.

**Import** (`ImportMembersModal`, `src/lib/member-import.ts`, `src/lib/csv.ts`, `src/lib/spreadsheet.ts`) — the file (.xlsx via `read-excel-file`, or comma/tab-delimited .csv/.tsv/.txt with the Excel BOM stripped) is parsed in the browser into `string[][]`. `detectHeaderRow` finds the header among the first 10 rows (title rows above it are skipped) and `autoMapColumns` matches headers by name (case/punctuation-insensitive, with aliases in `HEADER_ALIASES`). The review step lets admins change the header row and each column's mapping and shows a dry run of every row from `previewMemberImport`; nothing is saved until they confirm. Both actions share `buildImportRows`. Only the name is required: Last + First Name, or a Full Name column split by `splitFullName`; a trailing initial ("Juan P.") becomes the middle initial when there's no M.I. value. Other cells are parsed leniently by the `parse*` helpers (M/F, "9am" → `9AM - Mandurriao` via `normalizeService`, "Music Team; Tech" → Music + Tech, aliases like "Victory Weekend"); anything unreadable is left blank and listed as a warning — the row is still imported. VGL names are matched against v-1's leaders ("First Last", "Last, First", or "Nickname Last"); a unique match links `vglId`, otherwise the name is kept as free text. Mobile numbers are normalized (incl. restoring the leading 0 Excel drops) but not format-validated. Max 5,000 rows, inserted in chunks with `onConflictDoNothing`, so people already in the database are skipped as duplicates — import adds new people only, it never updates existing ones.

**Duplicates** are detected via `isUniqueViolation` (`src/lib/db-errors.ts`) on the unique index rather than a pre-check.

**Time zone** — all dates are Asia/Manila (fixed UTC+8) via `src/lib/date.ts`; `manilaDateString()` gives the service date.

**Toasts** — `withToast(path, type, message)` on a redirect, or `useToastOnResult(state)` / `useToast().showToast` on the client.

**Path alias:** `@/*` maps to `src/*`.

### Environment variables
- `DATABASE_URL` — pooled connection (runtime); same database as v-1
- `DATABASE_URL_UNPOOLED` — direct connection (drizzle-kit)
- `SESSION_SECRET` — JWT signing secret
