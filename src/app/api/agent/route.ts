import { NextResponse } from "next/server";
import {
  authenticateAssistantRequest,
  rateLimitExceededResponse,
  rateLimitHeaders,
} from "@/lib/agent-auth";
import {
  buildAgentSpec,
  renderAgentSpecMarkdown,
  resolveBaseUrl,
} from "@/lib/agent-spec";
import { checkAgentReadRateLimit } from "@/lib/rate-limit";

function qualityForType(acceptHeader: string, targetType: string) {
  let best = -1;
  for (const part of acceptHeader.split(",")) {
    const [rawType, ...params] = part.trim().toLowerCase().split(";");
    if (rawType.trim() !== targetType) continue;
    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split("=");
      if (key === "q" && value !== undefined) {
        const parsed = Number(value);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          q = parsed;
        }
      }
    }
    if (q > best) best = q;
  }
  return best;
}

function prefersMarkdown(acceptHeader: string | null) {
  if (!acceptHeader) return false;
  const markdownQ = qualityForType(acceptHeader, "text/markdown");
  if (markdownQ <= 0) return false;
  const jsonQ = qualityForType(acceptHeader, "application/json");
  return markdownQ >= jsonQ;
}

export async function GET(request: Request) {
  const auth = authenticateAssistantRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const rateLimit = await checkAgentReadRateLimit(auth.apiKey);
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const url = new URL(request.url);
    const rawFormat = url.searchParams.get("format")?.trim().toLowerCase();
    let format: "json" | "markdown";
    if (!rawFormat) {
      format = prefersMarkdown(request.headers.get("accept"))
        ? "markdown"
        : "json";
    } else if (rawFormat === "json") {
      format = "json";
    } else if (rawFormat === "markdown" || rawFormat === "md") {
      format = "markdown";
    } else {
      return NextResponse.json(
        { error: "Unsupported format. Use 'json' or 'markdown'." },
        {
          status: 400,
          headers: {
            Vary: "Accept",
            "Cache-Control": "private, no-store",
            ...rateLimitHeaders(rateLimit),
          },
        },
      );
    }

    const spec = buildAgentSpec(resolveBaseUrl(request));
    const headers: HeadersInit = {
      Vary: "Accept",
      "Cache-Control": "private, no-store",
      ...rateLimitHeaders(rateLimit),
    };

    if (format === "markdown") {
      return new NextResponse(renderAgentSpecMarkdown(spec), {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "text/markdown; charset=utf-8",
        },
      });
    }

    return NextResponse.json(spec, { status: 200, headers });
  } catch (error) {
    console.error("Agent specification request failed.", error);
    return NextResponse.json(
      { error: "Agent specification could not be loaded." },
      { status: 500 },
    );
  }
}
