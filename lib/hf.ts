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

/**
 * The free serverless tier frequently returns "model is busy" for a given
 * model/provider. We try the configured model first, then fall back across a
 * few other chat-capable instruct models so a demo never dead-ends on one
 * provider's capacity. De-duplicated, primary first.
 */
export const CHAT_MODEL_FALLBACKS = Array.from(
  new Set([
    CHAT_MODEL,
    "meta-llama/Llama-3.1-8B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "HuggingFaceH4/zephyr-7b-beta",
  ])
);

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Transient errors worth retrying / falling back on (capacity, cold start). */
function isTransient(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("busy") ||
    msg.includes("loading") ||
    msg.includes("currently loading") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("overloaded") ||
    msg.includes("timeout") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  );
}

async function callChatModel(
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const res = await hf.chatCompletion({
    model,
    messages,
    max_tokens: opts.maxTokens ?? 500,
    temperature: opts.temperature ?? 0.7,
  });
  const text = res.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from the debate model.");
  return text;
}

/**
 * Generative call used by the debate opponent + debrief + bootstrapper.
 * Uses the chat-completion interface the serverless router exposes for instruct
 * models. Retries transient "busy" errors with backoff, then falls back across
 * alternate models so the free tier's capacity swings don't break a demo.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  assertToken();

  let lastErr: any = null;
  for (const model of CHAT_MODEL_FALLBACKS) {
    // Up to 2 attempts per model for transient blips before moving on.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callChatModel(model, messages, opts);
      } catch (err) {
        lastErr = err;
        if (isTransient(err) && attempt === 0) {
          await sleep(1200);
          continue; // retry same model once
        }
        break; // non-transient, or already retried → next model
      }
    }
  }
  throw new Error(
    `All debate models were unavailable. Last error: ${
      lastErr?.message || lastErr
    }`
  );
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
 *
 * We call the HF inference router directly rather than the typed
 * `zeroShotClassification` helper: the serverless provider returns
 * `[{label, score}, ...]`, which the SDK's output validator rejects. The raw
 * call is stable across provider shapes and we normalize both here.
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

  const res = await fetch(
    `https://router.huggingface.co/hf-inference/models/${CLASSIFIER_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: `Debate topic: "${topic}". Student's argument: ${argument}`,
        parameters: { candidate_labels: candidateLabels },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Classifier request failed (${res.status}). ${detail.slice(0, 200)}`
    );
  }

  const raw = (await res.json()) as unknown;

  // Normalize both known shapes:
  //  - array of elements: [{label, score}, ...]  (current router shape)
  //  - object: {labels: [...], scores: [...]}     (classic API shape)
  let labels: string[] = [];
  let scores: number[] = [];

  const rec = raw as any;
  if (Array.isArray(raw) && raw.length && (raw[0] as any).label) {
    labels = (raw as any[]).map((r) => r.label);
    scores = (raw as any[]).map((r) => r.score);
  } else if (rec && Array.isArray(rec.labels) && Array.isArray(rec.scores)) {
    labels = rec.labels;
    scores = rec.scores;
  } else if (
    Array.isArray(raw) &&
    raw.length &&
    Array.isArray((raw[0] as any).labels)
  ) {
    labels = (raw[0] as any).labels;
    scores = (raw[0] as any).scores;
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
