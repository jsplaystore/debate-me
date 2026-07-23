"use client";

import { useState } from "react";

type Claim = { claim: string; context: string };

export function TopicBootstrapper({
  onPick,
}: {
  onPick: (claim: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);

  async function extract() {
    setLoading(true);
    setError(null);
    setClaims([]);
    try {
      const res = await fetch("/api/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reading }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to extract claims.");
      setClaims(data.claims);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-panel/60 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-medium text-slate-200">
          📚 Don&apos;t know what to debate yet? Paste a reading
        </span>
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-400">
            Paste lecture notes, an article, or a textbook excerpt. The AI will
            pull out the most debatable claims for you to pick from.
          </p>
          <textarea
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            placeholder="Paste your reading here…"
            rows={5}
            className="w-full rounded-lg border border-white/10 bg-ink/70 p-3 text-sm text-slate-100 outline-none focus:border-student"
          />
          <button
            type="button"
            onClick={extract}
            disabled={loading || reading.trim().length < 40}
            className="rounded-lg bg-student px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {loading ? "Reading…" : "Extract debatable claims"}
          </button>

          {error && <p className="text-xs text-error">{error}</p>}

          {claims.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300">
                Pick a claim to debate:
              </p>
              {claims.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPick(c.claim)}
                  className="block w-full rounded-lg border border-white/10 bg-ink/60 p-3 text-left transition hover:border-student"
                >
                  <div className="text-sm font-medium text-slate-100">
                    {c.claim}
                  </div>
                  {c.context && (
                    <div className="mt-0.5 text-xs text-slate-400">
                      {c.context}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
