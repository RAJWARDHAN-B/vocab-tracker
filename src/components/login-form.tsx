"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl: "/",
      });
      if (result?.error) {
        setError("Sign in failed. Check your credentials and server configuration.");
        return;
      }
      router.replace(result?.url ?? "/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <label>
        Username
        <input
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label>
        Password
        <input
          autoComplete="current-password"
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error && <p className="error-message" role="alert">{error}</p>}
      <button className="button button-primary" disabled={submitting}>
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
