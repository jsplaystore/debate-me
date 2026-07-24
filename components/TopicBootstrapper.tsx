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
    <div className="border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="label">Don&apos;t know enough yet? Paste a reading</span>
        <span className="kbd">{open ? "[ − ]" : "[ + ]"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-line px-4 py-4">
          <p className="text-[13px] text-muted">
            Paste lecture notes, an article, or a textbook excerpt. The AI pulls
            out the most debatable claims for you to pick from.
          </p>
          <textarea
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            placeholder="Paste your reading…"
            rows={5}
            className="w-full border border-line bg-paper p-3 text-[14px] text-ink outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            type="button"
            onClick={extract}
            disabled={loading || reading.trim().length < 40}
            className="label border border-ink bg-ink px-4 py-2 text-surface transition disabled:opacity-30"
          >
            {loading ? "Reading…" : "Extract claims"}
          </button>

          {error && <p className="font-mono text-[12px] text-low">{error}</p>}

          {claims.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="label">Pick a claim</p>
              {claims.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPick(c.claim)}
                  className="block w-full border border-line bg-paper p-3 text-left transition hover:border-accent"
                >
                  <div className="text-[14px] text-ink">{c.claim}</div>
                  {c.context && (
                    <div className="mt-1 text-[12px] text-muted">
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
