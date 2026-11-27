import Link from "next/link";
import { redirect } from "next/navigation";
import { WordForm } from "@/components/word-form";
import { isOwnerSignedIn } from "@/lib/auth";

export default async function NewWordPage() {
  if (!(await isOwnerSignedIn())) redirect("/login");
  return (
    <main className="narrow-shell">
      <Link className="back-link" href="/">← Back to words</Link>
      <div className="page-heading">
        <p className="eyebrow">Grow your collection</p>
        <h1>Add a word</h1>
        <p className="muted">Keep your example and sentence distinct—both are saved as entered.</p>
      </div>
      <section className="panel form-panel"><WordForm /></section>
    </main>
  );
}
