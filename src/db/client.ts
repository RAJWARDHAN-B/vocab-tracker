import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const databaseUrl = process.env.TURSO_DATABASE_URL ?? "file:./data/vocab.db";

if (databaseUrl.startsWith("file:") && databaseUrl !== "file::memory:") {
  const filePath = databaseUrl.slice("file:".length);
  mkdirSync(dirname(resolve(filePath)), { recursive: true });
}

export const client = createClient({
  url: databaseUrl,
  ...(process.env.TURSO_AUTH_TOKEN
    ? { authToken: process.env.TURSO_AUTH_TOKEN }
    : {}),
});

export const db = drizzle(client, { schema });

let foreignKeysPromise: Promise<unknown> | undefined;

export async function enableForeignKeys() {
  foreignKeysPromise ??= client.execute("PRAGMA foreign_keys = ON").catch((error) => {
    foreignKeysPromise = undefined;
    throw error;
  });
  await foreignKeysPromise;
}
