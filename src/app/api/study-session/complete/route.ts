import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, enableForeignKeys } from "@/db/client";
import { studySessions } from "@/db/schema";
import { isOwnerSignedIn, sameOriginRequest } from "@/lib/auth";
import { localDateKey, REVIEW_TIME_ZONE, STUDY_GOAL_MS } from "@/lib/time";
import { z } from "zod";

const completionSchema = z.object({ id: z.string().uuid() });

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
  const parsed = completionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid study session is required." }, { status: 400 });
  }

  await enableForeignKeys();
  const [session] = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.id, parsed.data.id))
    .limit(1);
  if (!session) return NextResponse.json({ error: "Study session not found." }, { status: 404 });
  const today = localDateKey(new Date(), REVIEW_TIME_ZONE);
  if (session.localDay !== today) {
    return NextResponse.json({ error: "This timer expired at the end of its day." }, { status: 409 });
  }
  if (session.completedAt) return NextResponse.json({ session });

  const elapsedMs = Date.now() - new Date(session.startedAt).getTime();
  if (elapsedMs < STUDY_GOAL_MS) {
    return NextResponse.json(
      { error: "The five-minute timer has not finished.", remainingMs: STUDY_GOAL_MS - elapsedMs },
      { status: 409 },
    );
  }

  const completedAt = new Date().toISOString();
  const [updated] = await db
    .update(studySessions)
    .set({ completedAt })
    .where(and(eq(studySessions.id, session.id), isNull(studySessions.completedAt)))
    .returning();
  return NextResponse.json({ session: updated ?? { ...session, completedAt } });
}
