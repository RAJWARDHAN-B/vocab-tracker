import { migrate } from "drizzle-orm/libsql/migrator";
import { client, db, enableForeignKeys } from "./client";

async function main() {
  try {
    await enableForeignKeys();
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.info("Database migrations applied.");
  } finally {
    client.close();
  }
}

main().catch((error: unknown) => {
  console.error("Database migration failed.", error);
  process.exitCode = 1;
});
