import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isOwnerSignedIn } from "@/lib/auth";
import { checkImportRateLimit } from "@/lib/rate-limit";
import {
  formatValidationErrors,
  importRequestSchema,
  wordInputSchema,
} from "@/lib/validation";
import { createWord, listWords } from "@/lib/words";

const MAX_BODY_BYTES = 256 * 1024;

async function readLimitedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is required.");

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("Request body is too large.");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function GET(request: Request) {
  if (!(await isOwnerSignedIn())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const search = new URL(request.url).searchParams.get("q") ?? "";
  const results = await listWords(search.slice(0, 100));
  return NextResponse.json({ words: results });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const expectedKey = process.env.ASSISTANT_API_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      { error: "Assistant import is not configured on the server." },
      { status: 503 },
    );
  }
  const providedKey = match?.[1] ?? "";
  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(expectedKey);
  if (
    !match ||
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  try {
    const rateLimit = await checkImportRateLimit(match[1]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Import request limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          },
        },
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(await readLimitedBody(request));
    } catch (error) {
      if (error instanceof RangeError) {
        return NextResponse.json({ error: error.message }, { status: 413 });
      }
      return NextResponse.json({ error: "Malformed JSON request." }, { status: 400 });
    }

    const requestResult = importRequestSchema.safeParse(body);
    if (!requestResult.success) {
      return NextResponse.json(
        { error: "Invalid import request.", details: formatValidationErrors(requestResult.error) },
        { status: 400 },
      );
    }

    const results = [];
    for (const [index, rawEntry] of requestResult.data.words.entries()) {
      const validated = wordInputSchema.safeParse(rawEntry);
      if (!validated.success) {
        results.push({
          index,
          status: "invalid",
          errors: formatValidationErrors(validated.error),
        });
        continue;
      }
      const id = await createWord(validated.data);
      results.push(
        id
          ? { index, status: "created", id }
          : { index, status: "duplicate", message: "That normalized spelling already exists." },
      );
    }
    return NextResponse.json({ results }, {
      headers: {
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (error) {
    console.error("Word import failed.", error);
    return NextResponse.json({ error: "Word import could not be completed." }, { status: 500 });
  }
}
