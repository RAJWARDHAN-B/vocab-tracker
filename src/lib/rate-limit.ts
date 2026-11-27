import { createHash } from "node:crypto";
import { client, enableForeignKeys } from "@/db/client";

export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const RATE_LIMIT_WINDOW_SECONDS = RATE_LIMIT_WINDOW_MS / 1000;
export const IMPORT_RATE_LIMIT_MAX = 60;
export const AGENT_READ_RATE_LIMIT_MAX = 180;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

async function checkRateLimitBucket(
  bucketKey: string,
  maxRequests: number,
): Promise<RateLimitResult> {
  await enableForeignKeys();
  const now = Date.now();
  const id = createHash("sha256").update(bucketKey).digest("hex");
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
    args: [
      id,
      now,
      RATE_LIMIT_WINDOW_MS,
      now,
      RATE_LIMIT_WINDOW_MS,
      now,
      now,
    ],
  });
  const count = Number(result.rows[0]?.request_count ?? 0);
  const windowStart = Number(result.rows[0]?.window_start ?? now);
  return {
    allowed: count <= maxRequests,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - count),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000),
    ),
  };
}

export function checkImportRateLimit(apiKey: string) {
  return checkRateLimitBucket(apiKey, IMPORT_RATE_LIMIT_MAX);
}

export function checkAgentReadRateLimit(apiKey: string) {
  return checkRateLimitBucket(`agent-read:${apiKey}`, AGENT_READ_RATE_LIMIT_MAX);
}
