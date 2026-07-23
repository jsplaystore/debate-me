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

  function start() {
    if (!topic.trim()) return;
    setTopicAndPosition(topic.trim(), position);
    router.push("/debate");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-student via-white to-opponent bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
          Debate&nbsp;Me
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
          You learn a concept most deeply when forced to defend it. Pick a claim,
          choose your side, and argue against an AI that{" "}
          <span className="text-slate-200">won&apos;t let you off the hook</span>.
        </p>
      </header>

      <section className="space-y-5 rounded-2xl border border-white/10 bg-panel/50 p-5 shadow-xl">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            What&apos;s the claim?
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='e.g. "The New Deal helped end the Great Depression"'
            rows={2}
            className="w-full resize-none rounded-lg border border-white/10 bg-ink/70 p-3 text-sm text-slate-100 outline-none focus:border-student"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) start();
            }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setTopic(ex)}
                className="rounded-full border border-white/10 bg-ink/50 px-3 py-1 text-xs text-slate-300 transition hover:border-student hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            Your position
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["For", "Against"] as Position[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPosition(p)}
                className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                  position === p
                    ? "border-student bg-student/20 text-white"
                    : "border-white/10 bg-ink/50 text-slate-300 hover:border-white/30"
                }`}
              >
                {p === "For" ? "👍 For" : "👎 Against"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            The AI will argue{" "}
            <span className="font-semibold text-opponent">
              {position === "For" ? "Against" : "For"}
            </span>{" "}
            — the opposite of you.
          </p>
        </div>

        <button
          type="button"
          onClick={start}
          disabled={!topic.trim()}
          className="w-full rounded-lg bg-gradient-to-r from-student to-opponent px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-40"
        >
          Start the debate →
        </button>
      </section>

      <div className="mt-4">
        <TopicBootstrapper onPick={(claim) => setTopic(claim)} />
      </div>

      <footer className="mt-8 text-center text-xs text-slate-500">
        Powered by open-source models on the Hugging Face Inference API ·
        Generative debate + zero-shot argument scoring
      </footer>
    </main>
  );
}
