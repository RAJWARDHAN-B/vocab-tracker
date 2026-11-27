"use client";

import { useState } from "react";
import Link from "next/link";

type ReviewWord = {
  id: string;
  word: string;
  meaning: string;
  synonyms: string[];
  antonyms: string[];
  example: string;
  inASentence: string;
  imageUrl: string | null;
  imageCaption: string | null;
};

export function ReviewDeck({ words }: { words: ReviewWord[] }) {
  const [remainingWords, setRemainingWords] = useState(words);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const current = remainingWords[0];

  async function review(outcome: "again" | "got_it") {
    if (!current) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word_id: current.id, outcome }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Review could not be saved.");
      setRemainingWords((items) => items.slice(1));
      setRevealed(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Review could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!current) {
    return (
      <div className="panel empty-state">
        <span className="empty-icon">✓</span>
        <h2>{words.length ? "All done for now!" : "You're all caught up."}</h2>
        <p className="muted">
          {words.length ? "Your reviews were saved." : "There are no words due for review. Check back later."}
        </p>
        <Link className="button button-primary" href="/">Back to words</Link>
      </div>
    );
  }

  return (
    <div className="review-column">
      <p className="muted review-counter">
        Card {words.length - remainingWords.length + 1} of {words.length}
      </p>
      <article className="panel review-card">
        <p className="eyebrow">Vocabulary</p>
        <h2 className="review-word">{current.word}</h2>
        {revealed ? (
          <div className="answer-content">
            <section><h3>Meaning</h3><p>{current.meaning}</p></section>
            <div className="two-columns">
              <section><h3>Example</h3><p>{current.example}</p></section>
              <section><h3>In a sentence</h3><p>{current.inASentence}</p></section>
            </div>
            <div className="two-columns">
              <section><h3>Synonyms</h3><p>{current.synonyms.length ? current.synonyms.join(", ") : "—"}</p></section>
              <section><h3>Antonyms</h3><p>{current.antonyms.length ? current.antonyms.join(", ") : "—"}</p></section>
            </div>
            {current.imageUrl && <ReviewImage src={current.imageUrl} caption={current.imageCaption} />}
          </div>
        ) : (
          <button className="button button-secondary reveal-button" onClick={() => setRevealed(true)}>
            Reveal answer
          </button>
        )}
        {error && <p className="error-message" role="alert">{error}</p>}
        {revealed && (
          <div className="review-actions">
            <button className="button button-again" disabled={saving} onClick={() => review("again")}>
              Again <span>Review in 1 day</span>
            </button>
            <button className="button button-primary" disabled={saving} onClick={() => review("got_it")}>
              Got it <span>Schedule next review</span>
            </button>
          </div>
        )}
      </article>
    </div>
  );
}

function ReviewImage({ src, caption }: { src: string; caption: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="word-image">
      {failed ? (
        <div className="image-fallback">Image unavailable</div>
      ) : (
        <img src={src} alt={caption || "Vocabulary illustration"} onError={() => setFailed(true)} />
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
