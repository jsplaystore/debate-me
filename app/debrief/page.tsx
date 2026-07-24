"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDebate, transcriptText } from "@/lib/store";

type Debrief = {
  score: number;
  strengths: { point: string; why: string }[];
  gaps: { counterargument: string; impact: string }[];
  summary: string;
  suggestedReadings: string[];
};

function verdictLabel(score: number) {
  if (score >= 80) return { text: "Commanding", color: "text-good" };
  if (score >= 65) return { text: "Solid", color: "text-good" };
  if (score >= 45) return { text: "Contested", color: "text-mid" };
  return { text: "Exposed", color: "text-low" };
}

export default function DebriefScreen() {
  const router = useRouter();
  const { topic, position, turns, studentTurnCount, reset } = useDebate();
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topic || turns.length === 0) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/debrief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            position,
            transcript: transcriptText(turns),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Debrief failed.");
        if (!cancelled) setDebrief(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function newDebate() {
    reset();
    router.push("/");
  }

  const verdict = debrief ? verdictLabel(debrief.score) : null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-24">
      {/* Masthead */}
      <header className="border-b border-line pb-4 pt-10">
        <div className="label">Debrief</div>
        <h1 className="mt-2 font-display text-xl font-semibold leading-snug tracking-[-0.01em] text-ink">
          {topic}
        </h1>
        <p className="kbd mt-2">
          You argued {position.toUpperCase()} · {studentTurnCount} turns
        </p>
      </header>

      {loading && (
        <div className="flex items-center gap-2 py-16">
          <span className="label">Reviewing the transcript</span>
          <span className="kbd animate-blink">▍</span>
        </div>
      )}

      {error && (
        <div className="my-8 border border-low bg-low/5 p-4">
          <p className="font-mono text-[12px] text-low">{error}</p>
          <button
            onClick={() => location.reload()}
            className="label mt-3 border border-ink bg-ink px-3 py-2 text-surface"
          >
            Retry
          </button>
        </div>
      )}

      {debrief && !loading && verdict && (
        <div>
          {/* Verdict */}
          <section className="border-b border-line py-8">
            <div className="flex items-end justify-between">
              <div>
                <div className="label">Verdict</div>
                <div
                  className={`mt-1 font-display text-2xl font-bold tracking-[-0.02em] ${verdict.color}`}
                >
                  {verdict.text}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-6xl font-bold leading-none tracking-[-0.03em] text-ink">
                  {debrief.score}
                </div>
                <div className="label mt-1">Debate score / 100</div>
              </div>
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-ink">
              {debrief.summary}
            </p>
          </section>

          {/* Strengths */}
          <section className="border-b border-line py-8">
            <h2 className="label mb-4 text-good">What you argued well</h2>
            <ul className="space-y-5">
              {debrief.strengths.length === 0 && (
                <li className="text-[14px] text-muted">
                  No standout arguments this round — see the gaps below.
                </li>
              )}
              {debrief.strengths.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-mono text-[13px] text-good">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="text-[15px] text-ink">{s.point}</div>
                    <div className="mt-1 text-[13px] text-muted">{s.why}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Gaps */}
          <section className="border-b border-line py-8">
            <h2 className="label mb-4 text-low">
              Counterarguments you left standing
            </h2>
            <ul className="space-y-5">
              {debrief.gaps.map((g, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-mono text-[13px] text-low">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="text-[15px] text-ink">
                      {g.counterargument}
                    </div>
                    <div className="mt-1 text-[13px] text-muted">
                      {g.impact}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Readings */}
          <section className="border-b border-line py-8">
            <h2 className="label mb-4">Read next</h2>
            <ul>
              {debrief.suggestedReadings.map((r, i) => (
                <li
                  key={i}
                  className="flex gap-3 border-t border-line py-3 first:border-t-0"
                >
                  <span className="font-mono text-[13px] text-muted">→</span>
                  <span className="text-[14px] text-ink">{r}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-6">
            <button
              onClick={newDebate}
              className="label flex-1 border border-ink bg-ink px-4 py-3 text-surface transition hover:bg-accent hover:border-accent"
            >
              New debate
            </button>
            <button
              onClick={() => router.push("/debate")}
              className="label border border-line bg-surface px-4 py-3 text-muted transition hover:border-accent hover:text-ink"
            >
              Review transcript
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
