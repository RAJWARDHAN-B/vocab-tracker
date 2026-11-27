import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, enableForeignKeys } from "@/db/client";
import { reviews, words } from "@/db/schema";
import { localDateKey, REVIEW_TIME_ZONE, reviewStreak } from "@/lib/time";

export async function recordReview(
  wordId: string,
  outcome: "again" | "got_it",
) {
  await enableForeignKeys();
  const reviewedAt = new Date();
  return db.transaction(async (tx) => {
    const [word] = await tx
      .select({
        id: words.id,
        reviewIntervalDays: words.reviewIntervalDays,
      })
      .from(words)
      .where(eq(words.id, wordId))
      .limit(1);
    if (!word) return false;

    const intervalDays =
      outcome === "again"
        ? 1
        : word.reviewIntervalDays < 3
          ? 3
          : word.reviewIntervalDays < 7
            ? 7
            : word.reviewIntervalDays < 14
              ? 14
              : 30;
    const nextReviewAt = new Date(
      reviewedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    await tx.insert(reviews).values({
      id: randomUUID(),
      wordId,
      outcome,
      reviewedAt: reviewedAt.toISOString(),
    });
    await tx
      .update(words)
      .set({
        reviewIntervalDays: intervalDays,
        nextReviewAt,
        updatedAt: reviewedAt.toISOString(),
      })
      .where(eq(words.id, wordId));
    return true;
  });
}

export async function getReviewProgress(now = new Date()) {
  await enableForeignKeys();
  const events = await db
    .select({ reviewedAt: reviews.reviewedAt })
    .from(reviews);
  const dates = events.map(({ reviewedAt }) =>
    localDateKey(new Date(reviewedAt), REVIEW_TIME_ZONE),
  );
  const today = localDateKey(now, REVIEW_TIME_ZONE);
  return {
    reviewedToday: dates.filter((date) => date === today).length,
    streak: reviewStreak(dates, today),
  };
}
