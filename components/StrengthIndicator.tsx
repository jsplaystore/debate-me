"use client";

import type { StrengthLabel } from "@/lib/hf";

const META: Record<
  StrengthLabel,
  { label: string; color: string; bar: string; emoji: string }
> = {
  strong: {
    label: "Strong",
    color: "text-strong",
    bar: "bg-strong",
    emoji: "💪",
  },
  weak: {
    label: "Weak",
    color: "text-weak",
    bar: "bg-weak",
    emoji: "⚠️",
  },
  "off-topic": {
    label: "Off-topic",
    color: "text-offtopic",
    bar: "bg-offtopic",
    emoji: "🎯",
  },
  "contains-factual-error": {
    label: "Factual error",
    color: "text-error",
    bar: "bg-error",
    emoji: "❌",
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
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
        <span className="h-2 w-2 rounded-full bg-slate-500 animate-pulse-soft" />
        Scoring argument…
      </div>
    );
  }
  if (!strength) return null;

  const meta = META[strength.label];
  const pct = Math.round(strength.score * 100);

  return (
    <div className="mt-2 w-full">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${meta.color}`}>
          {meta.emoji} {meta.label}
        </span>
        <span className="text-slate-400">{pct}% confidence</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-700/60 overflow-hidden">
        <div
          className={`h-full ${meta.bar} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
