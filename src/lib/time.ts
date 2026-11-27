export const REVIEW_TIME_ZONE =
  process.env.REVIEW_TIME_ZONE ?? "Asia/Kolkata";
export const STUDY_GOAL_MS = 5 * 60 * 1000;

export function localDateKey(date: Date, timeZone = REVIEW_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function reviewStreak(reviewDates: string[], today: string) {
  const dates = new Set(reviewDates);
  let cursor = dates.has(today) ? today : previousDateKey(today);
  if (!dates.has(cursor)) return 0;

  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }
  return streak;
}
