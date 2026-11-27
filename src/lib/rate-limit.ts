import { createHash } from "node:crypto";
import { client, enableForeignKeys } from "@/db/client";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

export async function checkImportRateLimit(apiKey: string) {
  await enableForeignKeys();
  const now = Date.now();
  const id = createHash("sha256").update(apiKey).digest("hex");
  const result = await client.execute({
    sql: `INSERT INTO api_rate_limits (id, window_start, request_count)
      VALUES (?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        request_count = CASE
          WHEN api_rate_limits.window_start + ? <= ? THEN 1
          ELSE api_rate_limits.request_count + 1
        END,
        window_start = CASE
          WHEN api_rate_limits.window_start + ? <= ? THEN ?
          ELSE api_rate_limits.window_start
        END
      RETURNING request_count, window_start`,
    args: [id, now, WINDOW_MS, now, WINDOW_MS, now, now],
  });
  const count = Number(result.rows[0]?.request_count ?? 0);
  const windowStart = Number(result.rows[0]?.window_start ?? now);
  return {
    allowed: count <= MAX_REQUESTS_PER_WINDOW,
    limit: MAX_REQUESTS_PER_WINDOW,
    remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - count),
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart + WINDOW_MS - now) / 1000)),
  };
}
