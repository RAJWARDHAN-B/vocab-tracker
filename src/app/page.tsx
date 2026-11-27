import Link from "next/link";
import { redirect } from "next/navigation";
import { StudyTimer } from "@/components/study-timer";
import { Topbar } from "@/components/topbar";
import { isOwnerSignedIn } from "@/lib/auth";
import { getReviewProgress } from "@/lib/reviews";
import { localDateKey, REVIEW_TIME_ZONE } from "@/lib/time";
import { listDueWords, listWords } from "@/lib/words";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function HomePage({ searchParams }: Props) {
  if (!(await isOwnerSignedIn())) redirect("/login");

  const { q = "" } = await searchParams;
  const [words, dueWords, progress] = await Promise.all([
    listWords(q),
    listDueWords(),
    getReviewProgress(),
  ]);
  const today = localDateKey(new Date(), REVIEW_TIME_ZONE);

  return (
    <main className="app-shell">
      <Topbar active="words" dueCount={dueWords.length} />

      <section className="welcome-row">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Your vocabulary, growing daily.</h1>
          <p className="muted">A little practice, a little progress. Keep your words close.</p>
        </div>
        <Link className="button button-primary" href="/words/new">＋ Add a word</Link>
      </section>

      <div className="dashboard-grid">
        <StudyTimer />
        <section className="panel stats-panel">
          <p className="eyebrow">Your progress</p>
          <div className="stat-number">{progress.reviewedToday}</div>
          <p className="stat-label">words reviewed today</p>
          <div className="streak-row">
            <span className="streak-icon">✦</span>
            <span><strong>{progress.streak} day{progress.streak === 1 ? "" : "s"}</strong> current review streak</span>
          </div>
          <p className="label-hint">Time zone: {REVIEW_TIME_ZONE}</p>
        </section>
      </div>

      <section className="words-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your collection</p>
            <h2>Words <span className="count-badge">{words.length}</span></h2>
          </div>
          <form action="/" className="search-form">
            <input aria-label="Search words" name="q" placeholder="Search words..." defaultValue={q} />
            <button className="button button-secondary">Search</button>
          </form>
        </div>
        {words.length ? (
          <div className="word-grid">
            {words.map((word) => (
              <Link className="word-tile" href={`/words/${word.id}`} key={word.id}>
                <span className="word-tile-arrow">↗</span>
                <h3>{word.word}</h3>
                <p>{word.meaning}</p>
                <span className="word-meta">
                  {word.nextReviewAt <= new Date().toISOString() ? "Due for review" : `Next: ${new Date(word.nextReviewAt).toLocaleDateString("en-IN", { timeZone: REVIEW_TIME_ZONE })}`}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="panel empty-state">
            <span className="empty-icon">✦</span>
            <h2>{q ? "No words match that search." : "Your collection starts here."}</h2>
            <p className="muted">{q ? "Try a different spelling or meaning." : "Add a word you want to remember."}</p>
            {!q && <Link className="button button-primary" href="/words/new">Add your first word</Link>}
          </div>
        )}
      </section>
    </main>
  );
}
