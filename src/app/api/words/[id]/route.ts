import { NextResponse } from "next/server";
import { isOwnerSignedIn, sameOriginRequest } from "@/lib/auth";
import { formatValidationErrors, wordInputSchema } from "@/lib/validation";
import { getWord, updateWord } from "@/lib/words";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  if (!(await isOwnerSignedIn())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  const word = await getWord(id);
  if (!word) return NextResponse.json({ error: "Word not found." }, { status: 404 });
  return NextResponse.json({ word });
}

export async function PUT(request: Request, { params }: RouteContext) {
  if (!sameOriginRequest(request)) {
    return NextResponse.json({ error: "Request origin was rejected." }, { status: 403 });
  }
  if (!(await isOwnerSignedIn())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }
  const parsed = wordInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the highlighted fields.", details: formatValidationErrors(parsed.error) },
      { status: 400 },
    );
  }
  try {
    const { id } = await params;
    const result = await updateWord(id, parsed.data);
    if (result === "missing") return NextResponse.json({ error: "Word not found." }, { status: 404 });
    if (result === "duplicate") {
      return NextResponse.json({ error: "A word with this spelling already exists." }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Word update failed.", error);
    return NextResponse.json({ error: "The word could not be saved." }, { status: 500 });
  }
}
