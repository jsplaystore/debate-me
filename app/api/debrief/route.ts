import { NextRequest, NextResponse } from "next/server";
import { chat, type ChatMessage } from "@/lib/hf";
import {
  debriefSystemPrompt,
  debriefUserPrompt,
  type Position,
} from "@/lib/prompts";
import { extractJson } from "@/lib/json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  topic: string;
  position: Position;
  transcript: string;
};

export type Debrief = {
  score: number;
  strengths: { point: string; why: string }[];
  gaps: { counterargument: string; impact: string }[];
  summary: string;
  suggestedReadings: string[];
};

export async function POST(req: NextRequest) {
  try {
    const { topic, position, transcript } = (await req.json()) as Body;
    if (!topic || !position || !transcript) {
      return NextResponse.json(
        { error: "Missing debate data for debrief." },
        { status: 400 }
      );
    }

    const messages: ChatMessage[] = [
      { role: "system", content: debriefSystemPrompt() },
      {
        role: "user",
        content: debriefUserPrompt({ topic, studentPosition: position, transcript }),
      },
    ];

    const raw = await chat(messages, { maxTokens: 800, temperature: 0.4 });
    const parsed = extractJson<Debrief>(raw);

    // Clamp / sanitize.
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const debrief: Debrief = {
      score,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 4) : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 4) : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      suggestedReadings: Array.isArray(parsed.suggestedReadings)
        ? parsed.suggestedReadings.slice(0, 3)
        : [],
    };

    return NextResponse.json(debrief);
  } catch (err: any) {
    console.error("[/api/debrief]", err);
    return NextResponse.json(
      { error: err?.message || "Debrief generation failed." },
      { status: 500 }
    );
  }
}
