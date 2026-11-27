import { NextResponse } from "next/server";
import { z } from "zod";
import { isOwnerSignedIn, sameOriginRequest } from "@/lib/auth";
import { recordReview } from "@/lib/reviews";

const reviewSchema = z.object({
  word_id: z.string().uuid(),
  outcome: z.enum(["again", "got_it"]),
});

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
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid word and review outcome are required." }, { status: 400 });
  }
  try {
    const saved = await recordReview(parsed.data.word_id, parsed.data.outcome);
    if (!saved) return NextResponse.json({ error: "Word not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review save failed.", error);
    return NextResponse.json({ error: "Review could not be saved." }, { status: 500 });
  }
}
