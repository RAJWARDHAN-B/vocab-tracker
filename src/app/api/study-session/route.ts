import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, enableForeignKeys } from "@/db/client";
import { studySessions } from "@/db/schema";
import { isOwnerSignedIn, sameOriginRequest } from "@/lib/auth";
import { localDateKey, REVIEW_TIME_ZONE, STUDY_GOAL_MS } from "@/lib/time";

export async function GET() {
  if (!(await isOwnerSignedIn())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  await enableForeignKeys();
  const today = localDateKey(new Date(), REVIEW_TIME_ZONE);
  const [session] = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.localDay, today))
    .limit(1);
  return NextResponse.json({
    today,
    goalMs: STUDY_GOAL_MS,
    session: session ?? null,
    serverNow: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) {
    return NextResponse.json({ error: "Request origin was rejected." }, { status: 403 });
  }
  if (!(await isOwnerSignedIn())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  await enableForeignKeys();
  const today = localDateKey(new Date(), REVIEW_TIME_ZONE);
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  const [created] = await db
    .insert(studySessions)
    .values({ id, localDay: today, startedAt, completedAt: null })
    .onConflictDoNothing({ target: studySessions.localDay })
    .returning();
  const [session] = created
    ? [created]
    : await db
        .select()
        .from(studySessions)
        .where(eq(studySessions.localDay, today))
        .limit(1);
  return NextResponse.json(
    { session, goalMs: STUDY_GOAL_MS, serverNow: new Date().toISOString() },
    { status: created ? 201 : 200 },
  );
}
