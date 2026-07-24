"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDebate, type Turn } from "@/lib/store";
import { DebateMessage } from "@/components/DebateMessage";
import type { StrengthLabel } from "@/lib/hf";

const MIN_EXCHANGES = 5;

const STATUS_LINES = [
  "Building the counter…",
  "Finding the weak point…",
  "Loading a counterexample…",
  "Sharpening the question…",
];

export default function DebateScreen() {
  const router = useRouter();
  const {
    topic,
    position,
    turns,
    studentTurnCount,
    started,
    addTurn,
    scoreLastStudentTurn,
  } = useDebate();

  const [input, setInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    if (!started || !topic) router.replace("/");
  }, [started, topic, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, aiThinking]);

  // Cycle status lines while the AI is thinking.
  useEffect(() => {
    if (!aiThinking) return;
    const t = setInterval(
      () => setStatusIdx((i) => (i + 1) % STATUS_LINES.length),
      1400
    );
    return () => clearInterval(t);
  }, [aiThinking]);

  useEffect(() => {
    if (!started || !topic) return;
    if (openedRef.current) return;
    if (turns.length > 0) {
      openedRef.current = true;
      return;
    }
    openedRef.current = true;
    void openDebate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, topic]);

  async function openDebate() {
    setAiThinking(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, position, history: [], opening: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The AI failed to open.");
      addTurn({ role: "opponent", content: data.reply });
    } catch (e: any) {
      setError(e.message);
      openedRef.current = false;
    } finally {
      setAiThinking(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || aiThinking) return;
    setInput("");
    setError(null);

    const studentTurn: Turn = { role: "student", content: text };
    addTurn(studentTurn);

    const history = [...turns, studentTurn].map((t) => ({
      role: t.role,
      content: t.content,
    }));

    setScoring(true);
    let weakness: StrengthLabel | null = null;
    try {
      const sres = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ argument: text, topic }),
      });
      const sdata = await sres.json();
      if (sres.ok) {
        scoreLastStudentTurn({
          label: sdata.label,
          score: sdata.score,
          scores: sdata.scores,
        });
        weakness = sdata.label as StrengthLabel;
      }
    } catch {
      /* scoring is best-effort */
    } finally {
      setScoring(false);
    }

    setAiThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, position, history, weakness }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The AI failed to respond.");
      addTurn({ role: "opponent", content: data.reply });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAiThinking(false);
    }
  }

  const canEnd = studentTurnCount >= MIN_EXCHANGES;
  const remaining = Math.max(0, MIN_EXCHANGES - studentTurnCount);

  if (!started || !topic) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-line bg-paper/95 pb-3 pt-6 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="label mb-1">Resolution</div>
            <div className="font-display text-[16px] leading-snug tracking-[-0.01em] text-ink">
              {topic}
            </div>
            <div className="kbd mt-1.5">
              You <span className="text-accent">{position.toUpperCase()}</span>
              {"  ·  "}
              AI{" "}
              <span className="text-low">
                {position === "For" ? "AGAINST" : "FOR"}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[13px] text-ink">
              {String(studentTurnCount).padStart(2, "0")}
              <span className="text-muted">/{MIN_EXCHANGES}+</span>
            </div>
            <div className="label mt-0.5">Turns</div>
          </div>
        </div>
      </div>

      {/* Stream */}
      <div ref={scrollRef} className="stream flex-1 overflow-y-auto">
        {turns.map((t, i) => (
          <DebateMessage
            key={i}
            turn={t}
            scoring={
              scoring &&
              t.role === "student" &&
              i === turns.length - 1 &&
              !t.strength
            }
          />
        ))}

        {aiThinking && (
          <div className="border-t border-line py-5 first:border-t-0">
            <div className="label mb-2 text-low">Opponent</div>
            <div className="kbd flex items-center gap-2">
              <span>{STATUS_LINES[statusIdx]}</span>
              <span className="animate-blink">▍</span>
            </div>
          </div>
        )}

        {error && (
          <div className="my-5 border border-low bg-low/5 px-4 py-3 font-mono text-[12px] text-low">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 border-t border-line bg-paper/95 py-4 backdrop-blur">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={
            turns.length === 0
              ? "The AI is preparing its opening…"
              : "Make your argument…"
          }
          rows={3}
          disabled={aiThinking && turns.length === 0}
          className="w-full resize-none border border-line bg-surface p-3 text-[15px] text-ink outline-none placeholder:text-muted focus:border-accent disabled:opacity-50"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="kbd">
            {canEnd
              ? "Minimum reached — end whenever you're ready"
              : `${remaining} more argument${remaining === 1 ? "" : "s"} to unlock the debrief`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/debrief")}
              disabled={!canEnd}
              className="label border border-line bg-surface px-3 py-2 text-muted transition enabled:hover:border-accent enabled:hover:text-ink disabled:opacity-30"
            >
              End & debrief
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={!input.trim() || aiThinking}
              className="label border border-ink bg-ink px-4 py-2 text-surface transition enabled:hover:bg-accent enabled:hover:border-accent disabled:opacity-30"
            >
              Send →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
