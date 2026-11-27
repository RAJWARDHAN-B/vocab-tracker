import { timingSafeEqual } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function validOwnerLogin(username: string, password: string) {
  const expectedUsername = process.env.OWNER_USERNAME;
  const expectedPassword = process.env.OWNER_PASSWORD;
  return Boolean(
    process.env.AUTH_SECRET &&
      process.env.AUTH_SECRET.length >= 32 &&
      expectedUsername &&
      expectedPassword &&
      safeEqual(username, expectedUsername) &&
      safeEqual(password, expectedPassword),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize(credentials) {
        const username = credentials?.username;
        const password = credentials?.password;
        if (
          typeof username !== "string" ||
          typeof password !== "string" ||
          !validOwnerLogin(username, password)
        ) {
          return null;
        }
        return { id: "owner", name: "owner" };
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub === "owner") {
        session.user.name = "owner";
      }
      return session;
    },
  },
});
