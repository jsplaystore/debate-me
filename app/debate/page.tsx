"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDebate, type Turn } from "@/lib/store";
import { DebateMessage } from "@/components/DebateMessage";
import type { StrengthLabel } from "@/lib/hf";

const MIN_EXCHANGES = 5;

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
  const [lastWeakness, setLastWeakness] = useState<StrengthLabel | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);

  // Guard: no topic set → back to start.
  useEffect(() => {
    if (!started || !topic) {
      router.replace("/");
    }
  }, [started, topic, router]);

  // Auto-scroll on new content.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, aiThinking]);

  // Kick off the AI's opening argument once.
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
      openedRef.current = false; // allow retry
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

    // Build history AFTER adding the student's turn (store update is async-ish,
    // so construct it explicitly here).
    const history = [...turns, studentTurn].map((t) => ({
      role: t.role,
      content: t.content,
    }));

    // 1) Score the student's argument (classifier) — drives adaptation.
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
        setLastWeakness(weakness);
      }
    } catch {
      /* scoring is best-effort; never block the debate */
    } finally {
      setScoring(false);
    }

    // 2) Get the AI's adapted counter-argument.
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

  function endDebate() {
    // Stash transcript for the debrief screen via the persisted store.
    router.push("/debrief");
  }

  const canEnd = studentTurnCount >= MIN_EXCHANGES;
  const remaining = Math.max(0, MIN_EXCHANGES - studentTurnCount);

  if (!started || !topic) return null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 py-4 sm:px-4">
      {/* Header */}
      <div className="sticky top-0 z-10 -mx-3 mb-2 rounded-b-xl border-b border-white/10 bg-ink/80 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">
              {topic}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              You: <span className="text-student">{position}</span> · AI:{" "}
              <span className="text-opponent">
                {position === "For" ? "Against" : "For"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
              Turn {studentTurnCount}/{MIN_EXCHANGES}+
            </div>
            <button
              type="button"
              onClick={endDebate}
              disabled={!canEnd}
              className="rounded-full bg-strong/90 px-3 py-1 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
              title={
                canEnd
                  ? "End debate and see your debrief"
                  : `Make ${remaining} more argument${remaining === 1 ? "" : "s"} first`
              }
            >
              End & get debrief
            </button>
          </div>
        </div>
        {!canEnd && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-student to-opponent transition-all duration-500"
              style={{ width: `${(studentTurnCount / MIN_EXCHANGES) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Stream */}
      <div
        ref={scrollRef}
        className="debate-scroll flex-1 space-y-4 overflow-y-auto py-3"
      >
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
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-white/5 bg-panel px-4 py-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-opponent">
                AI Opponent
              </div>
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-pulse-soft rounded-full bg-opponent" />
                <span
                  className="h-2 w-2 animate-pulse-soft rounded-full bg-opponent"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="h-2 w-2 animate-pulse-soft rounded-full bg-opponent"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-md rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-center text-xs text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 -mx-3 border-t border-white/10 bg-ink/90 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex items-end gap-2">
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
                : "Make your argument… (Enter to send, Shift+Enter for a new line)"
            }
            rows={2}
            disabled={aiThinking && turns.length === 0}
            className="max-h-40 flex-1 resize-none rounded-xl border border-white/10 bg-panel/70 p-3 text-sm text-slate-100 outline-none focus:border-student disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!input.trim() || aiThinking}
            className="rounded-xl bg-student px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-slate-500">
          {lastWeakness
            ? "The AI is adapting to how you're arguing."
            : "Argue your strongest case — the AI is tracking your reasoning."}
        </p>
      </div>
    </main>
  );
}
