import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { ReviewDeck } from "@/components/review-deck";
import { isOwnerSignedIn } from "@/lib/auth";
import { getReviewProgress } from "@/lib/reviews";
import { listDueWords } from "@/lib/words";

export default async function ReviewPage() {
  if (!(await isOwnerSignedIn())) redirect("/login");
  const [dueWords, progress] = await Promise.all([listDueWords(), getReviewProgress()]);
  return (
    <main className="app-shell review-shell">
      <header className="topbar">
        <Link className="brand" href="/">Vocab<span>Garden</span></Link>
        <nav className="topbar-actions">
          <span className="muted">{progress.reviewedToday} reviewed today</span>
          <LogoutButton />
        </nav>
      </header>
      <div className="review-heading">
        <p className="eyebrow">Daily review</p>
        <h1>Make it stick.</h1>
        <p className="muted">Take your time. Every small review helps.</p>
      </div>
      <ReviewDeck words={dueWords} />
    </main>
  );
}
