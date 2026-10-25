# v-6-stm

Service team member (STM) database and per-service check-in. Admins add STMs (name, contact, lifestage, service, VGL, discipleship journey, ministries); staff check them in to a worship service and view attendance by date.

## Setup

```bash
nvm use 24
npm install
cp .env.local.example .env.local   # use the same DATABASE_URL / DATABASE_URL_UNPOOLED as v-1
npm run db:migrate                 # creates the stm_* tables only (see drizzle.config.ts tablesFilter)
npm run db:seed                    # creates the admin from SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD
npm run dev
```

This app shares v-1's database. All of its tables are prefixed `stm_`; drizzle-kit is scoped to `stm_*`, so it won't touch v-1's tables. The VGL field autocompletes from v-1's `victory_group_leaders` (read-only). See `CLAUDE.md` for details.

## Excel / CSV import

Members → **Import** (admins). Upload .xlsx, .csv, or tab-delimited .txt; headers in any order, title rows above the header are fine. Only the name is required (Last + First Name, or one Full Name column like `Dela Cruz, Juan P.`). A template is downloadable from the import dialog.

```
Last Name,First Name,Middle Initial,Nickname,Mobile Number,Facebook Messenger Name,Lifestage,Age,Gender,Service Attending,Email,VGL,Discipleship Journey Completed,Ministry
Dela Cruz,Juan,P,Jun,09171234567,Juan Dela Cruz,Single,28,Male,9AM - Mandurriao,juan@example.com,Maria Santos,One2One; Victory Weekend/Victory Day,Music; Tech
```

Several ministries or discipleship steps go in one cell separated by `;` or `,`. Values that can't be read are left blank (shown on the review step before anything is saved). People already in the database (same name and mobile number) are skipped.
