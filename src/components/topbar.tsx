import Link from "next/link";
import { FernMark } from "@/components/fern-mark";
import { LogoutButton } from "@/components/logout-button";

type TopbarProps = {
  active?: "words" | "review";
  dueCount?: number;
  reviewedToday?: number;
};

export function Topbar({ active, dueCount, reviewedToday }: TopbarProps) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <FernMark className="brand-mark" />
        <span>Fern</span>
      </Link>
      <nav aria-label="Primary" className="topbar-actions">
        {typeof reviewedToday === "number" && (
          <span className="muted topbar-meta">{reviewedToday} reviewed today</span>
        )}
        <Link
          aria-current={active === "words" ? "page" : undefined}
          className={active === "words" ? "nav-link nav-link-active" : "nav-link"}
          href="/"
        >
          Words
        </Link>
        <Link
          aria-current={active === "review" ? "page" : undefined}
          className={active === "review" ? "nav-link nav-link-active" : "nav-link"}
          href="/review"
        >
          Review
          {typeof dueCount === "number" && dueCount > 0 && (
            <span className="nav-count">{dueCount}</span>
          )}
        </Link>
        <LogoutButton />
      </nav>
    </header>
  );
}
