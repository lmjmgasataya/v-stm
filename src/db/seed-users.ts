import "dotenv/config";
import { db } from ".";
import { users } from "./schema";
import bcrypt from "bcryptjs";

// Creates (or resets) the first admin. Set SEED_ADMIN_PASSWORD to avoid the default.
const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme";

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  await db
    .insert(users)
    .values({ username, passwordHash, name: "Admin", role: "admin" })
    .onConflictDoUpdate({ target: users.username, set: { passwordHash, role: "admin" } });
  console.log(`✓ ${username} (admin)`);
  if (!process.env.SEED_ADMIN_PASSWORD) console.log("Password is the default 'changeme' — change it before deploying.");
  process.exit(0);
}

main();
