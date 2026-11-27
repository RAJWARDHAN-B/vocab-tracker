import { NextResponse } from "next/server";
import { isOwnerSignedIn, sameOriginRequest } from "@/lib/auth";
import { formatValidationErrors, wordInputSchema } from "@/lib/validation";
import { createWord } from "@/lib/words";

export async function POST(request: Request) {
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
    const id = await createWord(parsed.data);
    if (!id) {
      return NextResponse.json({ error: "A word with this spelling already exists." }, { status: 409 });
    }
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Manual word creation failed.", error);
    return NextResponse.json({ error: "The word could not be saved." }, { status: 500 });
  }
}
