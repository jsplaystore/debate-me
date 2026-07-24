"use client";

import type { StrengthLabel } from "@/lib/hf";

const META: Record<
  StrengthLabel,
  { label: string; text: string; bar: string }
> = {
  strong: { label: "Strong", text: "text-good", bar: "bg-good" },
  weak: { label: "Weak", text: "text-mid", bar: "bg-mid" },
  "off-topic": { label: "Off-topic", text: "text-muted", bar: "bg-muted" },
  "contains-factual-error": {
    label: "Factual error",
    text: "text-low",
    bar: "bg-low",
  },
};

export function StrengthIndicator({
  strength,
  loading,
}: {
  strength?: {
    label: StrengthLabel;
    score: number;
    scores: Record<StrengthLabel, number>;
  };
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <span className="label">Scoring</span>
        <span className="kbd animate-blink">—</span>
      </div>
    );
  }
  if (!strength) return null;

  const meta = META[strength.label];
  const pct = Math.round(strength.score * 100);

  return (
    <div className="mt-2.5 w-full">
      <div className="flex items-center justify-between">
        <span className="label">Argument strength</span>
        <span className={`font-mono text-[11px] ${meta.text}`}>
          {meta.label} · {pct}%
        </span>
      </div>
      <div className="mt-1.5 h-[3px] w-full bg-line">
        <div
          className={`h-full ${meta.bar} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
