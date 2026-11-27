import { NextResponse } from "next/server";
import { handleAssistantWordImport } from "@/lib/agent-import";
import { isOwnerSignedIn } from "@/lib/auth";
import { WORD_TAGS, type WordTag } from "@/lib/validation";
import { listWords } from "@/lib/words";

export async function GET(request: Request) {
  if (!(await isOwnerSignedIn())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const searchParams = new URL(request.url).searchParams;
  const search = searchParams.get("q") ?? "";
  const rawTag = searchParams.get("tag")?.trim() ?? "";
  let tag: WordTag | undefined;
  if (rawTag) {
    if (!(WORD_TAGS as readonly string[]).includes(rawTag)) {
      return NextResponse.json(
        { error: `Invalid tag parameter. Allowed values: ${WORD_TAGS.join(", ")}.` },
        { status: 400 },
      );
    }
    tag = rawTag as WordTag;
  }
  const results = await listWords(search.slice(0, 100), tag);
  return NextResponse.json({ words: results });
}

export async function POST(request: Request) {
  return handleAssistantWordImport(request);
}
