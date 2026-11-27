import { redirect } from "next/navigation";
import { ReviewDeck } from "@/components/review-deck";
import { Topbar } from "@/components/topbar";
import { isOwnerSignedIn } from "@/lib/auth";
import { getReviewProgress } from "@/lib/reviews";
import { listDueWords } from "@/lib/words";

export default async function ReviewPage() {
  if (!(await isOwnerSignedIn())) redirect("/login");
  const [dueWords, progress] = await Promise.all([listDueWords(), getReviewProgress()]);
  return (
    <main className="app-shell">
      <Topbar
        active="review"
        dueCount={dueWords.length}
        reviewedToday={progress.reviewedToday}
      />
      <div className="review-content">
        <div className="review-heading">
          <p className="eyebrow">Daily review</p>
          <h1>Make it stick.</h1>
          <p className="muted">Take your time. Every small review helps.</p>
        </div>
        <ReviewDeck words={dueWords} />
      </div>
    </main>
  );
}
