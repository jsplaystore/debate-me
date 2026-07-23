"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StrengthLabel } from "./hf";
import type { Position } from "./prompts";

export type Role = "student" | "opponent";

export type Turn = {
  role: Role;
  content: string;
  // Only present for student turns once scored:
  strength?: {
    label: StrengthLabel;
    score: number;
    scores: Record<StrengthLabel, number>;
  };
};

export type DebateState = {
  topic: string;
  position: Position; // the student's side
  turns: Turn[];
  // convenience: how many *student* turns have happened
  studentTurnCount: number;
  started: boolean;

  setTopicAndPosition: (topic: string, position: Position) => void;
  addTurn: (turn: Turn) => void;
  scoreLastStudentTurn: (strength: Turn["strength"]) => void;
  reset: () => void;
};

export const useDebate = create<DebateState>()(
  persist(
    (set, get) => ({
      topic: "",
      position: "For",
      turns: [],
      studentTurnCount: 0,
      started: false,

      setTopicAndPosition: (topic, position) =>
        set({
          topic,
          position,
          turns: [],
          studentTurnCount: 0,
          started: true,
        }),

      addTurn: (turn) =>
        set((s) => ({
          turns: [...s.turns, turn],
          studentTurnCount:
            turn.role === "student"
              ? s.studentTurnCount + 1
              : s.studentTurnCount,
        })),

      scoreLastStudentTurn: (strength) =>
        set((s) => {
          const turns = [...s.turns];
          for (let i = turns.length - 1; i >= 0; i--) {
            if (turns[i].role === "student") {
              turns[i] = { ...turns[i], strength };
              break;
            }
          }
          return { turns };
        }),

      reset: () =>
        set({
          topic: "",
          position: "For",
          turns: [],
          studentTurnCount: 0,
          started: false,
        }),
    }),
    {
      name: "debate-me-state",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

export function transcriptText(turns: Turn[]): string {
  return turns
    .map(
      (t) => `${t.role === "student" ? "Student" : "Opponent"}: ${t.content}`
    )
    .join("\n\n");
}
