import { randomUUID } from "node:crypto";
import { and, desc, eq, like, lte, ne } from "drizzle-orm";
import { db, enableForeignKeys } from "@/db/client";
import { words } from "@/db/schema";
import { normalizeWord, toWordInput, type WordInput } from "@/lib/validation";

export async function createWord(input: WordInput) {
  await enableForeignKeys();
  const now = new Date().toISOString();
  const id = randomUUID();
  const inserted = await db
    .insert(words)
    .values({
      id,
      ...toWordInput(input),
      normalizedWord: normalizeWord(input.word),
      nextReviewAt: now,
      reviewIntervalDays: 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: words.normalizedWord })
    .returning({ id: words.id });
  return inserted[0]?.id ?? null;
}

export async function updateWord(id: string, input: WordInput) {
  await enableForeignKeys();
  const normalizedWord = normalizeWord(input.word);
  const conflict = await db
    .select({ id: words.id })
    .from(words)
    .where(and(eq(words.normalizedWord, normalizedWord), ne(words.id, id)))
    .limit(1);
  if (conflict.length) return "duplicate";

  let updated: { id: string }[];
  try {
    updated = await db
      .update(words)
      .set({
        ...toWordInput(input),
        normalizedWord,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(words.id, id))
      .returning({ id: words.id });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed: words.normalized_word")
    ) {
      return "duplicate";
    }
    throw error;
  }
  if (updated.length > 0) return "updated";
  const existing = await db.select({ id: words.id }).from(words).where(eq(words.id, id)).limit(1);
  return existing.length > 0 ? "duplicate" : "missing";
}

export async function getWord(id: string) {
  await enableForeignKeys();
  const result = await db.select().from(words).where(eq(words.id, id)).limit(1);
  return result[0] ?? null;
}

export async function listWords(search = "") {
  await enableForeignKeys();
  const query = search.trim();
  return db
    .select()
    .from(words)
    .where(query ? like(words.word, `%${query}%`) : undefined)
    .orderBy(desc(words.createdAt));
}

export async function listDueWords(now = new Date()) {
  await enableForeignKeys();
  const due = await db
    .select()
    .from(words)
    .where(lte(words.nextReviewAt, now.toISOString()));
  for (let index = due.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [due[index], due[swapIndex]] = [due[swapIndex], due[index]];
  }
  return due.slice(0, 10);
}
