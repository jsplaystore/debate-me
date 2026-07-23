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

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color =
    score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative h-36 w-36">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold text-white">{score}</span>
        <span className="text-xs text-slate-400">/ 100</span>
      </div>
    </div>
  );
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

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <header className="mb-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Debate Debrief
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-100">{topic}</h1>
        <p className="mt-1 text-xs text-slate-400">
          You argued <span className="text-student">{position}</span> across{" "}
          {studentTurnCount} turns
        </p>
      </header>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 animate-pulse-soft rounded-full bg-student" />
            <span
              className="h-3 w-3 animate-pulse-soft rounded-full bg-white"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="h-3 w-3 animate-pulse-soft rounded-full bg-opponent"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
          <p className="text-sm">Analyzing your performance…</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-center text-sm text-red-200">
          {error}
          <div className="mt-3">
            <button
              onClick={() => location.reload()}
              className="rounded-lg bg-student px-4 py-2 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {debrief && !loading && (
        <div className="space-y-5">
          {/* Score */}
          <section className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-panel/50 p-6 sm:flex-row sm:items-center">
            <ScoreRing score={debrief.score} />
            <div className="flex-1 text-center sm:text-left">
              <div className="text-sm font-semibold text-slate-200">
                Debate Score
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                {debrief.summary}
              </p>
            </div>
          </section>

          {/* Strengths */}
          <section className="rounded-2xl border border-strong/20 bg-strong/5 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-strong">
              ✅ What you argued well
            </h2>
            <ul className="space-y-3">
              {debrief.strengths.map((s, i) => (
                <li key={i}>
                  <div className="text-sm font-medium text-slate-100">
                    {s.point}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">{s.why}</div>
                </li>
              ))}
              {debrief.strengths.length === 0 && (
                <li className="text-xs text-slate-400">
                  No standout strong arguments this round — see the gaps below.
                </li>
              )}
            </ul>
          </section>

          {/* Gaps */}
          <section className="rounded-2xl border border-opponent/20 bg-opponent/5 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-opponent">
              ⚔️ Counterarguments you never addressed
            </h2>
            <ul className="space-y-3">
              {debrief.gaps.map((g, i) => (
                <li key={i}>
                  <div className="text-sm font-medium text-slate-100">
                    {g.counterargument}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {g.impact}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Readings */}
          <section className="rounded-2xl border border-white/10 bg-panel/50 p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-200">
              📖 Read these to strengthen your case
            </h2>
            <div className="flex flex-wrap gap-2">
              {debrief.suggestedReadings.map((r, i) => (
                <span
                  key={i}
                  className="rounded-full border border-white/10 bg-ink/60 px-3 py-1.5 text-xs text-slate-200"
                >
                  {r}
                </span>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={newDebate}
              className="flex-1 rounded-xl bg-gradient-to-r from-student to-opponent px-4 py-3 text-sm font-bold text-white"
            >
              Debate something new
            </button>
            <button
              onClick={() => router.push("/debate")}
              className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-200"
            >
              Review transcript
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
