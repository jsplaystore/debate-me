import { NextRequest, NextResponse } from "next/server";
import { chatJson, type ChatMessage } from "@/lib/hf";
import { bootstrapSystemPrompt, bootstrapUserPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { reading: string };

export type BootstrapResult = {
  claims: { claim: string; context: string }[];
};

export async function POST(req: NextRequest) {
  try {
    const { reading } = (await req.json()) as Body;
    if (!reading || reading.trim().length < 40) {
      return NextResponse.json(
        { error: "Paste a longer reading (at least a paragraph)." },
        { status: 400 }
      );
    }

    const messages: ChatMessage[] = [
      { role: "system", content: bootstrapSystemPrompt() },
      // Cap reading length to keep us on the free tier's token budget.
      { role: "user", content: bootstrapUserPrompt(reading.slice(0, 6000)) },
    ];

    const parsed = await chatJson<BootstrapResult>(messages, {
      maxTokens: 600,
      temperature: 0.4,
    });
    const claims = Array.isArray(parsed.claims)
      ? parsed.claims.filter((c) => c && c.claim).slice(0, 5)
      : [];

    if (claims.length === 0) {
      return NextResponse.json(
        { error: "Couldn't find debatable claims in that reading." },
        { status: 422 }
      );
    }

    return NextResponse.json({ claims });
  } catch (err: any) {
    console.error("[/api/bootstrap]", err);
    return NextResponse.json(
      { error: err?.message || "Bootstrapping failed." },
      { status: 500 }
    );
  }
}
