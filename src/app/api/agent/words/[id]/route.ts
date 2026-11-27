import { NextResponse } from "next/server";
import {
  authenticateAssistantRequest,
  rateLimitExceededResponse,
  rateLimitHeaders,
} from "@/lib/agent-auth";
import { checkAgentReadRateLimit } from "@/lib/rate-limit";
import { getWordByIdOrSpelling, serializeWordForAgent } from "@/lib/words";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const auth = authenticateAssistantRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const rateLimit = await checkAgentReadRateLimit(auth.apiKey);
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const { id } = await params;
    const word = await getWordByIdOrSpelling(id);
    if (!word) {
      return NextResponse.json(
        { error: "Word not found." },
        {
          status: 404,
          headers: {
            "Cache-Control": "private, no-store",
            ...rateLimitHeaders(rateLimit),
          },
        },
      );
    }

    return NextResponse.json(
      { word: serializeWordForAgent(word) },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
          ...rateLimitHeaders(rateLimit),
        },
      },
    );
  } catch (error) {
    console.error("Agent word lookup failed.", error);
    return NextResponse.json(
      { error: "The word could not be retrieved." },
      { status: 500 },
    );
  }
}
