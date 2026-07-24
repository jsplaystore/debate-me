"use client";

import type { Turn } from "@/lib/store";
import { StrengthIndicator } from "./StrengthIndicator";

export function DebateMessage({
  turn,
  scoring,
}: {
  turn: Turn;
  scoring?: boolean;
}) {
  const isStudent = turn.role === "student";
  return (
    <div className="animate-fade-in border-t border-line py-5 first:border-t-0">
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`label ${isStudent ? "text-accent" : "text-low"}`}
        >
          {isStudent ? "You" : "Opponent"}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
        {turn.content}
      </p>
      {isStudent && (
        <StrengthIndicator strength={turn.strength} loading={scoring} />
      )}
    </div>
  );
}
