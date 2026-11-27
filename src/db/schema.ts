import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { WORD_TAGS } from "@/lib/validation";

export const words = sqliteTable(
  "words",
  {
    id: text("id").primaryKey(),
    word: text("word").notNull(),
    normalizedWord: text("normalized_word").notNull(),
    tag: text("tag", { enum: WORD_TAGS }),
    meaning: text("meaning").notNull(),
    synonyms: text("synonyms", { mode: "json" }).$type<string[]>().notNull(),
    antonyms: text("antonyms", { mode: "json" }).$type<string[]>().notNull(),
    example: text("example").notNull(),
    inASentence: text("in_a_sentence").notNull(),
    imageUrl: text("image_url"),
    imageCaption: text("image_caption"),
    nextReviewAt: text("next_review_at").notNull(),
    reviewIntervalDays: integer("review_interval_days").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("words_normalized_word_unique").on(table.normalizedWord),
    index("words_next_review_at_idx").on(table.nextReviewAt),
    index("words_tag_idx").on(table.tag),
  ],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    wordId: text("word_id")
      .notNull()
      .references(() => words.id, { onDelete: "cascade" }),
    outcome: text("outcome", { enum: ["again", "got_it"] }).notNull(),
    reviewedAt: text("reviewed_at").notNull(),
  },
  (table) => [
    index("reviews_word_id_idx").on(table.wordId),
    index("reviews_reviewed_at_idx").on(table.reviewedAt),
    check("reviews_outcome_check", sql`${table.outcome} IN ('again', 'got_it')`),
  ],
);

export const apiRateLimits = sqliteTable("api_rate_limits", {
  id: text("id").primaryKey(),
  windowStart: integer("window_start").notNull(),
  requestCount: integer("request_count").notNull(),
});

export const studySessions = sqliteTable(
  "study_sessions",
  {
    id: text("id").primaryKey(),
    localDay: text("local_day").notNull(),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [uniqueIndex("study_sessions_local_day_unique").on(table.localDay)],
);
