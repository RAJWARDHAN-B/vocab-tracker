import { NextResponse } from "next/server";
import {
  authenticateAssistantRequest,
  rateLimitExceededResponse,
  rateLimitHeaders,
} from "@/lib/agent-auth";
import { handleAssistantWordImport } from "@/lib/agent-import";
import {
  AGENT_LIST_DEFAULT_LIMIT,
  AGENT_LIST_MAX_LIMIT,
} from "@/lib/agent-spec";
import { checkAgentReadRateLimit } from "@/lib/rate-limit";
import { listWordsPaginated, serializeWordForAgent } from "@/lib/words";

function parseBoundedInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (raw === null || raw.trim() === "") return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

export async function GET(request: Request) {
  const auth = authenticateAssistantRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const rateLimit = await checkAgentReadRateLimit(auth.apiKey);
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const searchParams = new URL(request.url).searchParams;
    const limit = parseBoundedInt(
      searchParams.get("limit"),
      AGENT_LIST_DEFAULT_LIMIT,
      1,
      AGENT_LIST_MAX_LIMIT,
    );
    if (limit === null) {
      return NextResponse.json(
        {
          error: `Invalid limit parameter. Provide an integer between 1 and ${AGENT_LIST_MAX_LIMIT}.`,
        },
        { status: 400, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const offset = parseBoundedInt(
      searchParams.get("offset"),
      0,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    if (offset === null) {
      return NextResponse.json(
        {
          error:
            "Invalid offset parameter. Provide a non-negative integer.",
        },
        { status: 400, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const search = (searchParams.get("q") ?? "").slice(0, 100);
    const { items, total } = await listWordsPaginated({
      search,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        words: items.map(serializeWordForAgent),
        total,
        limit,
        offset,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
          ...rateLimitHeaders(rateLimit),
        },
      },
    );
  } catch (error) {
    console.error("Agent word list request failed.", error);
    return NextResponse.json(
      { error: "Words could not be retrieved." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleAssistantWordImport(request);
}
