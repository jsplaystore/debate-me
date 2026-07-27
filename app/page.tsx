"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDebate } from "@/lib/store";
import type { Position } from "@/lib/prompts";
import { TopicBootstrapper } from "@/components/TopicBootstrapper";

const EXAMPLES = [
  "The New Deal helped end the Great Depression",
  "Recursion is better than iteration",
  "Utilitarianism is the best ethical framework",
  "Social media has been net-negative for democracy",
];

export default function TopicScreen() {
  const router = useRouter();
  const setTopicAndPosition = useDebate((s) => s.setTopicAndPosition);
  const [topic, setTopic] = useState("");
  const [position, setPosition] = useState<Position>("For");
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState<{
    reason: string;
    suggestion: string;
    kind: string;
  } | null>(null);

  async function start() {
    const t = topic.trim();
    if (!t || checking) return;
    setBlocked(null);
    setChecking(true);
    try {
      const res = await fetch("/api/topic-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t }),
      });
      const data = await res.json();
      if (res.ok && data.debatable === false) {
        setBlocked({
          reason: data.reason || "That isn't a debatable claim.",
          suggestion: data.suggestion || "",
          kind: data.kind || "",
        });
        return; // hard-stop: don't debate settled facts or falsehoods
      }
    } catch {
      /* fail open: if the gate errors, let the debate proceed */
    } finally {
      setChecking(false);
    }
    setTopicAndPosition(t, position);
    router.push("/debate");
  }

  function applySuggestion(s: string) {
    setTopic(s);
    setBlocked(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-24">
      {/* Masthead */}
      <header className="border-b border-line pb-5 pt-10">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            DEBATE&nbsp;ME
          </h1>
          <span className="label hidden sm:block">Adversarial learning</span>
        </div>
        <p className="mt-2 max-w-lg text-[14px] text-muted">
          Defend what you think you know. Your opponent takes the opposing side
          and presses until you prove you understand it, then hands you a
          debrief.
        </p>
      </header>

      {/* The claim */}
      <section className="pt-8">
        <label className="label">The claim</label>
        <textarea
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            if (blocked) setBlocked(null);
          }}
          placeholder="State a resolution to defend…"
          rows={2}
          className="mt-2 w-full resize-none border border-line bg-surface p-4 font-display text-[18px] leading-snug tracking-[-0.01em] text-ink outline-none placeholder:text-muted focus:border-accent"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) start();
          }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setTopic(ex)}
              className="border border-line bg-surface px-3 py-1.5 text-[12px] text-muted transition hover:border-accent hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      </section>

      {/* Position */}
      <section className="pt-8">
        <label className="label">Your side</label>
        <div className="mt-2 grid grid-cols-2 border border-line">
          {(["For", "Against"] as Position[]).map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setPosition(p)}
              className={`px-4 py-3 font-mono text-[13px] uppercase tracking-[0.12em] transition ${
                i === 0 ? "border-r border-line" : ""
              } ${
                position === p
                  ? "bg-ink text-surface"
                  : "bg-surface text-muted hover:text-ink"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">
          Your opponent argues{" "}
          <span className="font-mono text-low">
            {position === "For" ? "AGAINST" : "FOR"}
          </span>
          , the opposite of you.
        </p>
      </section>

      {/* Run */}
      <section className="pt-8">
        <button
          type="button"
          onClick={start}
          disabled={!topic.trim() || checking}
          className="flex w-full items-center justify-between border border-ink bg-ink px-5 py-4 transition hover:bg-accent hover:border-accent disabled:cursor-not-allowed disabled:opacity-30"
        >
          <span className="font-mono text-[13px] uppercase tracking-[0.14em] text-surface">
            {checking ? "Checking the claim…" : "Open the debate"}
          </span>
          <span className="kbd text-surface/70">
            {checking ? "▍" : "Ctrl + Enter →"}
          </span>
        </button>

        {blocked && (
          <div className="mt-3 border border-low bg-low/5 p-4">
            <div className="label text-low">Not a debatable claim</div>
            <p className="mt-2 text-[14px] text-ink">{blocked.reason}</p>
            <p className="mt-1 text-[13px] text-muted">
              This tool won&apos;t argue against settled facts or defend
              falsehoods. You&apos;d be practicing on misinformation.
            </p>
            {blocked.suggestion && (
              <button
                type="button"
                onClick={() => applySuggestion(blocked.suggestion)}
                className="mt-3 block w-full border border-line bg-surface p-3 text-left transition hover:border-accent"
              >
                <span className="label text-muted">Debate this instead</span>
                <span className="mt-1 block text-[14px] text-ink">
                  {blocked.suggestion}
                </span>
              </button>
            )}
          </div>
        )}
      </section>

      <div className="pt-4">
        <TopicBootstrapper onPick={(claim) => setTopic(claim)} />
      </div>

      <footer className="mt-auto pt-10">
        <p className="kbd">
          Open-source models · generative opponent + argument classifier
        </p>
      </footer>
    </main>
  );
}
