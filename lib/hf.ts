import { InferenceClient } from "@huggingface/inference";

/**
 * Central Hugging Face client + model config.
 *
 * All model calls in this app go through the free Hugging Face Inference API.
 * We deliberately keep model names in env vars so we can swap to whatever is
 * live on the free serverless tier at demo time without a code change.
 */

const HF_TOKEN = process.env.HF_TOKEN;

export const CHAT_MODEL =
  process.env.HF_CHAT_MODEL || "meta-llama/Meta-Llama-3-8B-Instruct";

export const CLASSIFIER_MODEL =
  process.env.HF_CLASSIFIER_MODEL || "facebook/bart-large-mnli";

if (!HF_TOKEN) {
  // Don't throw at import time (breaks the build); surface it per-request instead.
  console.warn(
    "[debate-me] HF_TOKEN is not set. Add it to .env.local — the app cannot call models without it."
  );
}

export const hf = new InferenceClient(HF_TOKEN);

export function assertToken() {
  if (!HF_TOKEN) {
    throw new Error(
      "HF_TOKEN is not configured. Create a free token at https://huggingface.co/settings/tokens and add it to .env.local"
    );
  }
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Generative call used by the debate opponent + debrief + bootstrapper.
 * Uses the chat-completion interface which the serverless router exposes for
 * instruct models like Llama-3 / Mixtral.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  assertToken();
  const res = await hf.chatCompletion({
    model: CHAT_MODEL,
    messages,
    max_tokens: opts.maxTokens ?? 500,
    temperature: opts.temperature ?? 0.7,
  });
  const text = res.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty response from the debate model.");
  }
  return text;
}

export type StrengthLabel =
  | "strong"
  | "weak"
  | "off-topic"
  | "contains-factual-error";

export const STRENGTH_LABELS: StrengthLabel[] = [
  "strong",
  "weak",
  "off-topic",
  "contains-factual-error",
];

export type ClassifierResult = {
  label: StrengthLabel;
  score: number;
  scores: Record<StrengthLabel, number>;
};

/**
 * Zero-shot classification of a student's argument turn.
 * We phrase the candidate labels as natural-language hypotheses so BART-MNLI
 * has enough signal (bare keywords score poorly on NLI).
 */
export async function classifyArgument(
  argument: string,
  topic: string
): Promise<ClassifierResult> {
  assertToken();

  const hypotheses: Record<string, StrengthLabel> = {
    "This is a strong, well-reasoned argument backed by evidence.": "strong",
    "This is a weak or vague argument with little support.": "weak",
    "This is off-topic and does not address the debate.": "off-topic",
    "This argument contains a factual error or false claim.":
      "contains-factual-error",
  };

  const candidateLabels = Object.keys(hypotheses);

  const raw = (await hf.zeroShotClassification({
    model: CLASSIFIER_MODEL,
    inputs: `Debate topic: "${topic}". Student's argument: ${argument}`,
    parameters: { candidate_labels: candidateLabels },
  })) as unknown;

  // The serverless API can return either an object {labels, scores} or an
  // array wrapping it, depending on model/version. Normalize both.
  let labels: string[] = [];
  let scores: number[] = [];

  const rec = Array.isArray(raw) ? (raw[0] as any) : (raw as any);
  if (rec && Array.isArray(rec.labels) && Array.isArray(rec.scores)) {
    labels = rec.labels;
    scores = rec.scores;
  } else if (Array.isArray(raw) && raw.length && (raw[0] as any).label) {
    // Some versions return [{label, score}, ...]
    labels = (raw as any[]).map((r) => r.label);
    scores = (raw as any[]).map((r) => r.score);
  } else {
    throw new Error("Unexpected classifier response shape.");
  }

  const scoreMap = {
    strong: 0,
    weak: 0,
    "off-topic": 0,
    "contains-factual-error": 0,
  } as Record<StrengthLabel, number>;

  labels.forEach((hyp, i) => {
    const mapped = hypotheses[hyp];
    if (mapped) scoreMap[mapped] = scores[i] ?? 0;
  });

  // Winning label = highest score.
  let best: StrengthLabel = "weak";
  let bestScore = -1;
  (Object.keys(scoreMap) as StrengthLabel[]).forEach((l) => {
    if (scoreMap[l] > bestScore) {
      bestScore = scoreMap[l];
      best = l;
    }
  });

  return { label: best, score: bestScore, scores: scoreMap };
}
