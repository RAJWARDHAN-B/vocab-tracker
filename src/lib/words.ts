import { randomUUID } from "node:crypto";
import { and, count, desc, eq, like, lte, ne, or } from "drizzle-orm";
import { db, enableForeignKeys } from "@/db/client";
import { words } from "@/db/schema";
import { normalizeWord, toWordInput, type WordInput } from "@/lib/validation";

export type WordRow = typeof words.$inferSelect;

export type AgentWordRecord = {
  id: string;
  word: string;
  normalized_word: string;
  meaning: string;
  synonyms: string[];
  antonyms: string[];
  example: string;
  in_a_sentence: string;
  image_url: string | null;
  image_caption: string | null;
  next_review_at: string;
  review_interval_days: number;
  created_at: string;
  updated_at: string;
};

export function serializeWordForAgent(row: WordRow): AgentWordRecord {
  return {
    id: row.id,
    word: row.word,
    normalized_word: row.normalizedWord,
    meaning: row.meaning,
    synonyms: row.synonyms,
    antonyms: row.antonyms,
    example: row.example,
    in_a_sentence: row.inASentence,
    image_url: row.imageUrl,
    image_caption: row.imageCaption,
    next_review_at: row.nextReviewAt,
    review_interval_days: row.reviewIntervalDays,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

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

export async function getWordByIdOrSpelling(identifier: string) {
  await enableForeignKeys();
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const byId = await db
    .select()
    .from(words)
    .where(eq(words.id, trimmed))
    .limit(1);
  if (byId[0]) return byId[0];

  const normalized = normalizeWord(trimmed);
  if (!normalized) return null;

  const bySpelling = await db
    .select()
    .from(words)
    .where(eq(words.normalizedWord, normalized))
    .limit(1);
  return bySpelling[0] ?? null;
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

export async function listWordsPaginated(options: {
  search?: string;
  limit: number;
  offset: number;
}) {
  await enableForeignKeys();
  const query = (options.search ?? "").trim();
  const normalizedQuery = normalizeWord(query);
  const filter = query
    ? or(
        like(words.word, `%${query}%`),
        like(words.normalizedWord, `%${normalizedQuery}%`),
      )
    : undefined;

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(words)
      .where(filter)
      .orderBy(desc(words.createdAt))
      .limit(options.limit)
      .offset(options.offset),
    db.select({ total: count() }).from(words).where(filter),
  ]);

  return {
    items,
    total: Number(totalRows[0]?.total ?? 0),
  };
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
