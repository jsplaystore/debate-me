import { NextRequest, NextResponse } from "next/server";
import { classifyArgument } from "@/lib/hf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { argument: string; topic: string; context?: string };

export async function POST(req: NextRequest) {
  try {
    const { argument, topic, context } = (await req.json()) as Body;
    if (!argument || !topic) {
      return NextResponse.json(
        { error: "Missing argument or topic." },
        { status: 400 }
      );
    }
    const result = await classifyArgument(argument, topic, context);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[/api/score]", err);
    return NextResponse.json(
      { error: err?.message || "Argument scoring failed." },
      { status: 500 }
    );
  }
}
