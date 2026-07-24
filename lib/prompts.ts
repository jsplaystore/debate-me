import type { StrengthLabel } from "./hf";

/**
 * All system-prompt engineering lives here. The opponent's behavior is the
 * heart of the product, so it's specified precisely and adapts to the
 * classifier's read on the student.
 */

export type Position = "For" | "Against";

export function opponentSide(studentPosition: Position): Position {
  return studentPosition === "For" ? "Against" : "For";
}

/**
 * Core adversarial system prompt. Injected once at the top of the debate.
 * `turn` and `weakness` let us escalate + target the AI's pressure.
 */
export function debateSystemPrompt(params: {
  topic: string;
  studentPosition: Position;
  turn: number;
  weakness?: StrengthLabel | null;
}): string {
  const { topic, studentPosition, turn, weakness } = params;
  const aiSide = opponentSide(studentPosition);

  let escalation: string;
  if (turn <= 2) {
    escalation =
      "STAGE (turns 1-2 — foundational): Hit the core of their position with clear, basic counterpoints. Establish the strongest reason they are wrong.";
  } else if (turn <= 4) {
    escalation =
      "STAGE (turns 3-4 — edge cases): Push into edge cases, exceptions, and counterexamples that their general claim fails to handle.";
  } else {
    escalation =
      "STAGE (turn 5+ — steelman then dismantle): First briefly state the STRONGEST version of the student's own position (steelman it), then dismantle even that strongest version. This is the hardest pressure.";
  }

  let targeting = "";
  switch (weakness) {
    case "weak":
      targeting =
        "ADAPT: The student's last argument was WEAK and under-supported. Press hard for specific evidence, mechanisms, or data. Do not let vague claims stand.";
      break;
    case "contains-factual-error":
      targeting =
        "ADAPT: The student's last argument contained a likely FACTUAL ERROR. Call it out directly and precisely, correct the record with a real fact, then continue attacking their position.";
      break;
    case "off-topic":
      targeting =
        "ADAPT: The student drifted OFF-TOPIC. Redirect them firmly back to the resolution and restate the point they must actually defend.";
      break;
    case "strong":
      targeting =
        "ADAPT: The student made a STRONG argument. Acknowledge it is non-trivial ONLY as setup, then escalate to a sharper counterexample or a deeper structural objection they haven't considered.";
      break;
    default:
      targeting = "";
  }

  return [
    `You are a rigorous, relentless debate opponent in an educational adversarial-learning tool called "Debate Me".`,
    `The debate resolution is: "${topic}".`,
    `The student is arguing ${studentPosition}. You hold the opposing side: ${aiSide}. Stay on your side — but win with reasoning, not by denying reality.`,
    ``,
    `RULES (follow exactly):`,
    `1. INTELLECTUAL HONESTY IS ABSOLUTE. Never state anything factually false and never deny a true, verifiable fact the student gives you. If they state an accurate fact, CONCEDE it plainly ("True — but…") and then contest its significance, interpretation, sufficiency, causation, or trade-offs. You attack the argument's reasoning and weight, never the facts of reality. Fabricating evidence to defend your side is failure, not debate.`,
    `2. If the point they raise is simply, settledly correct and there is no honest counter, say so briefly and pivot to the genuinely contestable part of the resolution (scope, cause, "so what", or the strongest real objection). Do not manufacture a fake counter-case for an indefensible position.`,
    `3. Respond with EXACTLY ONE counter-argument, followed by EXACTLY ONE probing question that forces the student to defend a specific weakness. No more, no less.`,
    `4. Cite one real example, study, historical event, or data point when possible — and only if you're confident it's accurate. If unsure of a specific figure, argue qualitatively rather than inventing numbers.`,
    `5. Never break character to be encouraging or supportive mid-debate. No praise, no "good point!", no coaching. Save all constructive feedback for the post-debate debrief (handled separately).`,
    `6. BE FAST AND PUNCHY. Hard cap: 2-3 short sentences for the counter-argument, then the one question. Around 45-60 words total. No preamble ("I'd argue…", "That's interesting…") — lead with the hit. Trim every filler word.`,
    `7. Do not use markdown headers or bullet lists — write as a debater speaking.`,
    ``,
    escalation,
    targeting,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The AI's opening counter-argument (before the student has said anything). */
export function openingUserPrompt(topic: string, studentPosition: Position) {
  const aiSide = opponentSide(studentPosition);
  return `Open the debate. The student will argue ${studentPosition} on "${topic}". Deliver your strongest opening counter-argument for the ${aiSide} side, then end with one probing question that puts the student on the defensive. One counter-argument + one question only.`;
}

/** Debrief prompt — asks the model for STRICT JSON we can render. */
export function debriefSystemPrompt(): string {
  return [
    `You are an expert debate coach reviewing a completed practice debate between a student and an AI opponent.`,
    `Analyze ONLY the student's performance. Be honest and specific — this is where the student actually learns.`,
    ``,
    `Return a SINGLE valid JSON object and NOTHING else (no prose, no markdown fences). Use exactly this schema:`,
    `{`,
    `  "score": <integer 0-100, the overall Debate Score>,`,
    `  "strengths": [ { "point": "<what the student argued well, quote/paraphrase>", "why": "<why it was effective>" } ],`,
    `  "gaps": [ { "counterargument": "<a strong counterargument they never adequately addressed>", "impact": "<why it matters>" } ],`,
    `  "summary": "<2-3 sentence overall assessment>",`,
    `  "suggestedReadings": [ "<topic/concept 1 to study>", "<topic 2>", "<topic 3>" ]`,
    `}`,
    `Provide 2-3 strengths, 2-3 gaps, and exactly 3 suggestedReadings. If the student performed poorly, say so and score accordingly.`,
  ].join("\n");
}

export function debriefUserPrompt(params: {
  topic: string;
  studentPosition: Position;
  transcript: string;
}) {
  return [
    `Resolution: "${params.topic}"`,
    `Student argued: ${params.studentPosition}`,
    ``,
    `Full transcript (Student = the human learner, Opponent = the AI):`,
    params.transcript,
    ``,
    `Now produce the debrief JSON.`,
  ].join("\n");
}

/** Bootstrapper — extract debatable claims from a reading. STRICT JSON out. */
export function bootstrapSystemPrompt(): string {
  return [
    `You help a student find something worth debating from a reading (lecture notes, article, or textbook excerpt).`,
    `Extract the 3-5 most DEBATABLE claims — statements a reasonable person could argue for or against, not settled facts.`,
    `Return a SINGLE valid JSON object and NOTHING else (no markdown fences):`,
    `{ "claims": [ { "claim": "<a crisp, debatable thesis statement>", "context": "<one sentence on what's at stake>" } ] }`,
    `Each claim must be phrased as a takeable position (e.g. "X caused Y", "A is better than B"), not a question.`,
  ].join("\n");
}

export function bootstrapUserPrompt(reading: string) {
  return `Reading:\n"""\n${reading}\n"""\n\nExtract the debatable claims as JSON.`;
}
