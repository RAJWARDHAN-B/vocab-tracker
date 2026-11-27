"use client";

import { useCallback, useEffect, useState } from "react";

type StudySession = {
  id: string;
  localDay: string;
  startedAt: string;
  completedAt: string | null;
};

type TimerState = {
  goalMs: number;
  serverNow: string;
  session: StudySession | null;
};

export function StudyTimer() {
  const [state, setState] = useState<TimerState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/study-session", { cache: "no-store" });
      const result = (await response.json()) as TimerState & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Timer status could not be loaded.");
      setState(result);
      setNow(Date.now());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Timer status could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const dayRefresh = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(dayRefresh);
    };
  }, [refresh]);

  const session = state?.session ?? null;
  const elapsed = session ? now - new Date(session.startedAt).getTime() : 0;
  const remaining = Math.max(0, (state?.goalMs ?? 300_000) - elapsed);

  async function start() {
    setError("");
    try {
      const response = await fetch("/api/study-session", { method: "POST" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Timer could not start.");
      await refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Timer could not start.");
    }
  }

  async function complete() {
    if (!session) return;
    setError("");
    try {
      const response = await fetch("/api/study-session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Timer could not be completed.");
      await refresh();
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Timer could not be completed.");
    }
  }

  const done = Boolean(session?.completedAt);
  const minutes = Math.floor(remaining / 60_000).toString().padStart(2, "0");
  const seconds = Math.floor((remaining % 60_000) / 1000).toString().padStart(2, "0");
  const progress = done ? 100 : Math.min(100, (elapsed / (state?.goalMs ?? 300_000)) * 100);

  return (
    <section className="panel timer-panel" aria-labelledby="timer-heading">
      <div>
        <p className="eyebrow">Daily focus</p>
        <h2 id="timer-heading">Five minutes, every day</h2>
        <p className="muted">
          {done ? "Today\u2019s session is complete." : session ? "Keep going\u2014you\u2019ve got this." : "Start a focused vocabulary session."}
        </p>
      </div>
      <div className="timer-display" aria-live="polite">
        {done ? "05:00" : `${minutes}:${seconds}`}
      </div>
      <div className="progress-track" aria-label={`${Math.round(progress)}% complete`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {!session && (
        <button className="button button-primary" disabled={loading} onClick={start}>
          Start today&apos;s timer
        </button>
      )}
      {session && !done && remaining === 0 && (
        <button className="button button-primary" onClick={complete}>
          Complete session
        </button>
      )}
      {session && !done && remaining > 0 && (
        <p className="label-hint">Timer continues if you refresh this page.</p>
      )}
    </section>
  );
}
