import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { RateLimitResult } from "@/lib/rate-limit";

export type AssistantAuthResult =
  | { ok: true; apiKey: string }
  | { ok: false; response: NextResponse };

export function authenticateAssistantRequest(
  request: Request,
): AssistantAuthResult {
  const expectedKey = process.env.ASSISTANT_API_KEY;
  if (!expectedKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Assistant API is not configured on the server." },
        { status: 503 },
      ),
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const providedKey = match?.[1] ?? "";
  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(expectedKey);

  if (
    !match ||
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid API key." },
        { status: 401 },
      ),
    };
  }

  return { ok: true, apiKey: providedKey };
}

export function rateLimitHeaders(rateLimit: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
  };
}

export function rateLimitExceededResponse(
  rateLimit: RateLimitResult,
  message = "Rate limit exceeded. Try again later.",
) {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(rateLimit.retryAfterSeconds),
        ...rateLimitHeaders(rateLimit),
      },
    },
  );
}
