import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { isOwnerSignedIn } from "@/lib/auth";

export default async function LoginPage() {
  if (await isOwnerSignedIn()) redirect("/");
  return (
    <main className="login-shell">
      <div className="login-brand">Vocab<span>Garden</span></div>
      <section className="panel login-panel">
        <p className="eyebrow">A quiet place to learn</p>
        <h1>Welcome back.</h1>
        <p className="muted">Sign in to your private vocabulary garden.</p>
        <LoginForm />
      </section>
      <p className="login-note">Private by design. Only your configured owner login can enter.</p>
    </main>
  );
}
