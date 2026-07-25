/**
 * Provider-agnostic LLM layer for Debate Me.
 *
 * Two inference backends are supported, both using open-source models:
 *   - "groq" — Groq's free, very fast OpenAI-compatible API (Llama-3.x, etc.)
 *   - "hf"   — Hugging Face serverless Inference API
 *
 * The active provider is chosen automatically: Groq if GROQ_API_KEY is set,
 * otherwise Hugging Face. Model names live in env vars so they can be swapped
 * at demo time without a code change.
 *
 * (File name kept as hf.ts so existing imports "@/lib/hf" stay stable.)
 */

import { InferenceClient } from "@huggingface/inference";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HF_TOKEN = process.env.HF_TOKEN;

export type Provider = "groq" | "hf";
export const PROVIDER: Provider =
  (process.env.LLM_PROVIDER as Provider) || (GROQ_API_KEY ? "groq" : "hf");

// ---- Model config ---------------------------------------------------------

const GROQ_CHAT_MODEL =
  process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";

const HF_CHAT_MODEL =
  process.env.HF_CHAT_MODEL || "meta-llama/Meta-Llama-3-8B-Instruct";

export const CHAT_MODEL = PROVIDER === "groq" ? GROQ_CHAT_MODEL : HF_CHAT_MODEL;

/**
 * Providers occasionally return "model busy" / rate-limit for a given model.
 * We try the configured model first, then fall back across other open instruct
 * models so a demo never dead-ends on one model's capacity. Primary first.
 */
export const CHAT_MODEL_FALLBACKS =
  PROVIDER === "groq"
    ? Array.from(
        new Set([
          GROQ_CHAT_MODEL,
          "llama-3.1-8b-instant",
          "llama3-70b-8192",
          "gemma2-9b-it",
        ])
      )
    : Array.from(
        new Set([
          HF_CHAT_MODEL,
          "meta-llama/Llama-3.1-8B-Instruct",
          "mistralai/Mistral-7B-Instruct-v0.3",
          "mistralai/Mixtral-8x7B-Instruct-v0.1",
          "HuggingFaceH4/zephyr-7b-beta",
        ])
      );

/** Zero-shot classifier used only on the HF path. */
export const CLASSIFIER_MODEL =
  process.env.HF_CLASSIFIER_MODEL || "facebook/bart-large-mnli";

const hf = new InferenceClient(HF_TOKEN);

if (PROVIDER === "groq" && !GROQ_API_KEY) {
  console.warn("[debate-me] PROVIDER=groq but GROQ_API_KEY is not set.");
}
if (PROVIDER === "hf" && !HF_TOKEN) {
  console.warn(
    "[debate-me] HF_TOKEN is not set. Add GROQ_API_KEY (recommended) or HF_TOKEN to .env.local."
  );
}

export function assertToken() {
  if (PROVIDER === "groq" && !GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not configured. Create a free key at https://console.groq.com/keys and add it to .env.local"
    );
  }
  if (PROVIDER === "hf" && !HF_TOKEN) {
    throw new Error(
      "No inference credentials. Add GROQ_API_KEY (free, https://console.groq.com/keys) or HF_TOKEN to .env.local"
    );
  }
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Error classification -------------------------------------------------

/** Transient errors worth retrying / falling back on (capacity, cold start). */
function isTransient(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("busy") ||
    msg.includes("loading") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("504") ||
    msg.includes("overloaded") ||
    msg.includes("timeout") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("too many requests") ||
    msg.includes("429")
  );
}

/** Hard walls — no point retrying or falling back across models. */
function isTerminal(err: any): { hit: boolean; message?: string } {
  const msg = String(err?.message || err || "").toLowerCase();
  if (
    msg.includes("depleted") ||
    msg.includes("monthly included credits") ||
    msg.includes("subscribe to pro") ||
    msg.includes("insufficient") ||
    msg.includes("payment required") ||
    msg.includes("402")
  ) {
    return {
      hit: true,
      message:
        "The inference account has run out of credits/quota. Swap in a key with available quota, then try again.",
    };
  }
  if (msg.includes("invalid api key") || msg.includes("invalid_api_key")) {
    return {
      hit: true,
      message:
        "The inference API key is invalid. Check GROQ_API_KEY (or HF_TOKEN) in .env.local.",
    };
  }
  if (msg.includes("401") || msg.includes("unauthorized")) {
    return {
      hit: true,
      message:
        "The provider rejected the API key (unauthorized). Check GROQ_API_KEY / HF_TOKEN.",
    };
  }
  return { hit: false };
}

// ---- Per-provider single calls -------------------------------------------

async function callGroq(
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 500,
      temperature: opts.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(`Groq ${res.status}: ${detail}`.slice(0, 300));
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from the debate model.");
  return text;
}

async function callHf(
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

function callChatModel(
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number }
): Promise<string> {
  return PROVIDER === "groq"
    ? callGroq(model, messages, opts)
    : callHf(model, messages, opts);
}

// ---- Public generative API ------------------------------------------------

/**
 * Generative call used by the debate opponent + debrief + bootstrapper.
 * Retries transient errors with backoff, then falls back across alternate open
 * models so provider capacity swings don't break a demo.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  assertToken();

  let lastErr: any = null;
  for (const model of CHAT_MODEL_FALLBACKS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callChatModel(model, messages, opts);
      } catch (err) {
        lastErr = err;
        const terminal = isTerminal(err);
        if (terminal.hit) throw new Error(terminal.message);
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

/**
 * chat() for endpoints that need JSON back. Runs the generation, tries to
 * extract JSON, and — if the model returned malformed/prose output — retries
 * once at a lower temperature with a blunt "return ONLY JSON" nudge. Raw output
 * is logged on hard failure so it's debuggable.
 */
export async function chatJson<T = any>(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<T> {
  const { extractJson } = await import("./json");

  const first = await chat(messages, {
    maxTokens: opts.maxTokens ?? 700,
    temperature: opts.temperature ?? 0.4,
  });
  try {
    return extractJson<T>(first);
  } catch {
    console.warn(
      "[chatJson] first parse failed, retrying strict. Raw:",
      first.slice(0, 400)
    );
  }

  const strictMessages: ChatMessage[] = [
    ...messages,
    {
      role: "user",
      content:
        "Your previous reply was not valid JSON. Reply again with ONLY the JSON object — no prose, no markdown code fences, no commentary. Start with { and end with }.",
    },
  ];
  const second = await chat(strictMessages, {
    maxTokens: opts.maxTokens ?? 700,
    temperature: 0.2,
  });
  try {
    return extractJson<T>(second);
  } catch (e) {
    console.error("[chatJson] second parse failed. Raw:", second.slice(0, 600));
    throw e;
  }
}

// ---- Argument-strength classifier ----------------------------------------

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

function argmax(scores: Record<StrengthLabel, number>): {
  label: StrengthLabel;
  score: number;
} {
  let best: StrengthLabel = "weak";
  let bestScore = -1;
  (Object.keys(scores) as StrengthLabel[]).forEach((l) => {
    if (scores[l] > bestScore) {
      bestScore = scores[l];
      best = l;
    }
  });
  return { label: best, score: bestScore };
}

/**
 * Classify a student's argument turn into strong / weak / off-topic /
 * contains-factual-error with confidences. This is the second model in the
 * feedback loop — its verdict is injected back into the opponent's prompt to
 * drive adaptation.
 *
 * On the Groq path we use a dedicated, low-temperature LLM-as-classifier call
 * (Groq doesn't host zero-shot NLI models). On the HF path we use BART-MNLI
 * zero-shot classification. Same output shape either way.
 */
export async function classifyArgument(
  argument: string,
  topic: string,
  context?: string
): Promise<ClassifierResult> {
  assertToken();
  return PROVIDER === "groq"
    ? classifyWithGroq(argument, topic, context)
    : classifyWithHf(argument, topic);
}

async function classifyWithGroq(
  argument: string,
  topic: string,
  context?: string
): Promise<ClassifierResult> {
  const system: ChatMessage = {
    role: "system",
    content: [
      "You are a FAIR debate-argument evaluator (think reasonable coach, not a harsh critic). Judge the quality of the student's latest argument as a move in the debate.",
      "Return a SINGLE JSON object and nothing else, with a probability (0-1) for each label; the four should sum to about 1:",
      '{ "strong": <0-1>, "weak": <0-1>, "off-topic": <0-1>, "contains-factual-error": <0-1> }',
      "CALIBRATION (important):",
      "- strong: makes a clear point supported by a REASON, mechanism, example, comparison, or evidence. A concise argument still counts as strong if it has real reasoning. Brevity is NOT weakness.",
      "- weak: ONLY for genuinely vague or unsupported assertions with no reasoning (e.g. 'it's just better', 'everyone knows that'), or an obvious logical fallacy. If the student gives any real reason or example, it is NOT weak.",
      "- off-topic: does not address the resolution at all.",
      "- contains-factual-error: asserts something clearly, verifiably FALSE. Do NOT flag this merely because facts are cited, and do NOT flag recent studies/events that may simply postdate your training as errors.",
      "Default to 'strong' when the argument has a legitimate point; reserve 'weak' for arguments that truly lack support. Be decisive but fair — avoid overconfident 90%+ scores unless the argument is clearly one category.",
    ].join("\n"),
  };
  const user: ChatMessage = {
    role: "user",
    content: [
      `Resolution: "${topic}"`,
      context
        ? `The opponent just argued: ${context}\n(Judge the student's argument as a reply to this.)`
        : "",
      `Student's latest argument: ${argument}`,
      ``,
      `Return the JSON scores.`,
    ]
      .filter(Boolean)
      .join("\n"),
  };

  let raw: Record<string, number>;
  try {
    raw = await chatJson<Record<string, number>>([system, user], {
      maxTokens: 200,
      temperature: 0.1,
    });
  } catch {
    // Never block the debate on scoring — fall back to a neutral read.
    return {
      label: "weak",
      score: 0.5,
      scores: { strong: 0.25, weak: 0.5, "off-topic": 0.15, "contains-factual-error": 0.1 },
    };
  }

  const scores: Record<StrengthLabel, number> = {
    strong: clamp01(raw["strong"]),
    weak: clamp01(raw["weak"]),
    "off-topic": clamp01(raw["off-topic"]),
    "contains-factual-error": clamp01(raw["contains-factual-error"]),
  };
  // Normalize to sum 1 for a stable confidence bar.
  const total =
    scores.strong +
    scores.weak +
    scores["off-topic"] +
    scores["contains-factual-error"];
  if (total > 0) {
    (Object.keys(scores) as StrengthLabel[]).forEach(
      (l) => (scores[l] = scores[l] / total)
    );
  }

  const { label, score } = argmax(scores);
  return { label, score, scores };
}

function clamp01(n: any): number {
  const v = Number(n);
  if (!isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/**
 * HF zero-shot classification via the inference router. Kept for the HF path.
 * We phrase candidate labels as natural-language hypotheses so BART-MNLI has
 * enough signal (bare keywords score poorly on NLI).
 */
async function classifyWithHf(
  argument: string,
  topic: string
): Promise<ClassifierResult> {
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

  let labels: string[] = [];
  let scoresArr: number[] = [];
  const rec = raw as any;
  if (Array.isArray(raw) && raw.length && (raw[0] as any).label) {
    labels = (raw as any[]).map((r) => r.label);
    scoresArr = (raw as any[]).map((r) => r.score);
  } else if (rec && Array.isArray(rec.labels) && Array.isArray(rec.scores)) {
    labels = rec.labels;
    scoresArr = rec.scores;
  } else if (
    Array.isArray(raw) &&
    raw.length &&
    Array.isArray((raw[0] as any).labels)
  ) {
    labels = (raw[0] as any).labels;
    scoresArr = (raw[0] as any).scores;
  } else {
    throw new Error("Unexpected classifier response shape.");
  }

  const scores: Record<StrengthLabel, number> = {
    strong: 0,
    weak: 0,
    "off-topic": 0,
    "contains-factual-error": 0,
  };
  labels.forEach((hyp, i) => {
    const mapped = hypotheses[hyp];
    if (mapped) scores[mapped] = scoresArr[i] ?? 0;
  });

  const { label, score } = argmax(scores);
  return { label, score, scores };
}
