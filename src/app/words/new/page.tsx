import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { WordForm } from "@/components/word-form";
import { isOwnerSignedIn } from "@/lib/auth";
import { listDueWords } from "@/lib/words";

export default async function NewWordPage() {
  if (!(await isOwnerSignedIn())) redirect("/login");
  const dueWords = await listDueWords();
  return (
    <main className="app-shell">
      <Topbar active="words" dueCount={dueWords.length} />
      <div className="narrow-content">
        <Link className="back-link" href="/">← Back to words</Link>
        <div className="page-heading">
          <p className="eyebrow">Grow your collection</p>
          <h1>Add a word</h1>
          <p className="muted">Keep your example and sentence distinct—both are saved as entered.</p>
        </div>
        <section className="panel form-panel"><WordForm /></section>
      </div>
    </main>
  );
}
