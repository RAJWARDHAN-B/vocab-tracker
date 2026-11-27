import { NextResponse } from "next/server";
import {
  authenticateAssistantRequest,
  rateLimitExceededResponse,
  rateLimitHeaders,
} from "@/lib/agent-auth";
import { checkImportRateLimit } from "@/lib/rate-limit";
import {
  formatValidationErrors,
  importRequestSchema,
  WORD_LIMITS,
  wordInputSchema,
} from "@/lib/validation";
import { createWord } from "@/lib/words";

async function readLimitedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is required.");

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > WORD_LIMITS.maxBodyBytes) {
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

export async function handleAssistantWordImport(request: Request) {
  const auth = authenticateAssistantRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const rateLimit = await checkImportRateLimit(auth.apiKey);
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        "Import request limit exceeded. Try again later.",
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > WORD_LIMITS.maxBodyBytes) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413, headers: rateLimitHeaders(rateLimit) },
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(await readLimitedBody(request));
    } catch (error) {
      if (error instanceof RangeError) {
        return NextResponse.json(
          { error: error.message },
          { status: 413, headers: rateLimitHeaders(rateLimit) },
        );
      }
      return NextResponse.json(
        { error: "Malformed JSON request." },
        { status: 400, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const requestResult = importRequestSchema.safeParse(body);
    if (!requestResult.success) {
      return NextResponse.json(
        {
          error: "Invalid import request.",
          details: formatValidationErrors(requestResult.error),
        },
        { status: 400, headers: rateLimitHeaders(rateLimit) },
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
          : {
              index,
              status: "duplicate",
              message: "That normalized spelling already exists.",
            },
      );
    }

    return NextResponse.json(
      { results },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    console.error("Word import failed.", error);
    return NextResponse.json(
      { error: "Word import could not be completed." },
      { status: 500 },
    );
  }
}
