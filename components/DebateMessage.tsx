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
    <div
      className={`flex animate-fade-in ${
        isStudent ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-lg ${
          isStudent
            ? "bg-student/90 rounded-br-sm"
            : "bg-panel border border-white/5 rounded-bl-sm"
        }`}
      >
        <div
          className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${
            isStudent ? "text-blue-100/80" : "text-opponent"
          }`}
        >
          {isStudent ? "You" : "AI Opponent"}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-50">
          {turn.content}
        </p>
        {isStudent && (
          <StrengthIndicator strength={turn.strength} loading={scoring} />
        )}
      </div>
    </div>
  );
}
