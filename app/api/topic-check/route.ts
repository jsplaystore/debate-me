import { NextRequest, NextResponse } from "next/server";
import { chatJson, type ChatMessage } from "@/lib/hf";
import { topicCheckSystemPrompt, topicCheckUserPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { topic: string };

export type TopicCheck = {
  debatable: boolean;
  kind: string;
  reason: string;
  suggestion: string;
};

export async function POST(req: NextRequest) {
  try {
    const { topic } = (await req.json()) as Body;
    if (!topic || topic.trim().length < 3) {
      return NextResponse.json({ error: "Enter a claim first." }, { status: 400 });
    }

    const messages: ChatMessage[] = [
      { role: "system", content: topicCheckSystemPrompt() },
      { role: "user", content: topicCheckUserPrompt(topic.trim()) },
    ];

    const parsed = await chatJson<TopicCheck>(messages, {
      maxTokens: 220,
      temperature: 0.1,
    });

    const result: TopicCheck = {
      debatable: parsed.debatable === true,
      kind: typeof parsed.kind === "string" ? parsed.kind : "unknown",
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      suggestion:
        typeof parsed.suggestion === "string" ? parsed.suggestion : "",
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[/api/topic-check]", err);
    // Fail open: if the gate itself errors, don't hard-block the user.
    return NextResponse.json(
      { debatable: true, kind: "unknown", reason: "", suggestion: "", degraded: true },
      { status: 200 }
    );
  }
}
