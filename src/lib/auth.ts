import { auth } from "@/auth";

export async function isOwnerSignedIn() {
  const session = await auth();
  return session?.user?.name === "owner";
}

export function sameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
