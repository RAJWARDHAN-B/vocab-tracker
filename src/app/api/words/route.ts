import { NextResponse } from "next/server";
import { handleAssistantWordImport } from "@/lib/agent-import";
import { isOwnerSignedIn } from "@/lib/auth";
import { listWords } from "@/lib/words";

export async function GET(request: Request) {
  if (!(await isOwnerSignedIn())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const search = new URL(request.url).searchParams.get("q") ?? "";
  const results = await listWords(search.slice(0, 100));
  return NextResponse.json({ words: results });
}

export async function POST(request: Request) {
  return handleAssistantWordImport(request);
}
