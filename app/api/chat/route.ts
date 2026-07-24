import { NextRequest, NextResponse } from "next/server";
import { chat, type ChatMessage, type StrengthLabel } from "@/lib/hf";
import {
  debateSystemPrompt,
  openingUserPrompt,
  type Position,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  topic: string;
  position: Position; // student's side
  // conversation so far, oldest first. role: "student" | "opponent"
  history: { role: "student" | "opponent"; content: string }[];
  // classifier read on the student's most recent turn, drives adaptation
  weakness?: StrengthLabel | null;
  opening?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { topic, position, history = [], weakness, opening } = body;

    if (!topic || !position) {
      return NextResponse.json(
        { error: "Missing topic or position." },
        { status: 400 }
      );
    }

    // Turn number = how many student turns have occurred (for escalation).
    const studentTurns = history.filter((h) => h.role === "student").length;
    const turn = Math.max(1, opening ? 1 : studentTurns);

    const system = debateSystemPrompt({
      topic,
      studentPosition: position,
      turn,
      weakness: weakness ?? null,
    });

    const messages: ChatMessage[] = [{ role: "system", content: system }];

    if (opening || history.length === 0) {
      messages.push({
        role: "user",
        content: openingUserPrompt(topic, position),
      });
    } else {
      for (const h of history) {
        messages.push({
          role: h.role === "student" ? "user" : "assistant",
          content: h.content,
        });
      }
    }

    // Short, punchy replies — cap tokens so the opponent stays snappy.
    const reply = await chat(messages, { maxTokens: 180, temperature: 0.75 });
    return NextResponse.json({ reply, turn });
  } catch (err: any) {
    console.error("[/api/chat]", err);
    return NextResponse.json(
      { error: err?.message || "Debate model call failed." },
      { status: 500 }
    );
  }
}
