# Debate Me 🥊

**An AI-powered adversarial learning tool for college students.**

You learn a concept most deeply when you're forced to _defend_ it — not just recall it. **Debate Me** puts you in a live, adversarial dialogue with an AI that argues the opposing side of any concept you're studying. It probes, challenges, and counters until you demonstrate genuine understanding. Make a factually wrong claim and it calls you out. Make a weak argument and it exploits it.

Built for an educational AI hackathon. 100% open-source models (Llama-3.x) — no OpenAI, no Anthropic. Runs on **Groq** (free, extremely fast) by default, with a **Hugging Face Inference API** fallback path.

---

## Why this works (the learning science)

Recall is passive; defense is active. Being cross-examined surfaces the gaps in your mental model that re-reading never will. Debate Me operationalizes that:

- **You** pick a claim and a side.
- **The AI** takes the opposite side and never lets up.
- **A classifier** grades every argument you make in real time and feeds that back to the AI, so the opponent presses exactly where you're weakest.
- **A debrief** at the end tells you what you argued well, which counterarguments you never answered, and what to study next.

## Two AI models working together (this is the point)

| Job | Model | Why |
| --- | --- | --- |
| **Debate opponent + debrief + reading analysis** | `llama-3.3-70b-versatile` on Groq (generative) | Produces adaptive, in-character counter-arguments and structured post-debate analysis. |
| **Argument-strength scoring** | dedicated low-temp classifier call → **strong / weak / off-topic / contains-factual-error** | A separate model call that grades each student turn and drives the opponent's adaptation. |

The classifier's read is injected back into the generative model's system prompt every turn — so a *weak* turn makes the AI demand evidence, a *factual error* makes it call out the mistake, and a *strong* turn makes it escalate to a sharper counterexample. **A generative debater + a separate argument classifier in a feedback loop is what makes the AI core to the product, not a chatbot wrapper.**

> **Provider note:** the scorer is provider-aware. On the **Groq** path it's a dedicated low-temperature LLM-as-classifier call returning calibrated label probabilities. On the **Hugging Face** path (`LLM_PROVIDER=hf`) it uses genuine zero-shot classification with `facebook/bart-large-mnli`. Same 4-label output either way.

## Features

- **Adversarial Debate Engine** — pick a topic + side, the AI opens with a strong counter-argument, then a real-time back-and-forth (minimum 5 exchanges). One counter-argument + one probing question per turn, escalating in complexity: basic counterpoints → edge cases → steelman-then-dismantle.
- **Live Argument Strength indicator** — every turn you send is scored by the classifier and shown with a confidence bar.
- **Adaptive opponent** — the AI targets whatever the classifier says is your weakness.
- **Structured debrief** — a 0–100 Debate Score, your strongest arguments (and why), the counterarguments you never addressed, and 3 topics to read next.
- **Topic Bootstrapper** — don't know enough to debate yet? Paste a reading (lecture notes, article, textbook excerpt) and the AI extracts the most debatable claims for you to pick from.
- **Zero friction** — no login, no database, mobile-friendly.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Groq** free API (OpenAI-compatible, Llama-3.x) — with a **Hugging Face Inference API** fallback via `@huggingface/inference`
- **zustand** for debate state (persisted to `sessionStorage` — no DB)
- API routes only; no separate server

## Project structure

```
/app
  page.tsx               # Topic input screen
  /debate/page.tsx       # Live debate screen
  /debrief/page.tsx      # Post-debate analysis
  /api
    /chat/route.ts       # Generative model — opponent, opening, adaptation
    /score/route.ts      # BART zero-shot classifier — argument strength
    /debrief/route.ts    # Generative model — structured JSON debrief
    /bootstrap/route.ts  # Generative model — extract claims from a reading
/components
  DebateMessage.tsx
  StrengthIndicator.tsx
  TopicBootstrapper.tsx
/lib
  hf.ts                  # Hugging Face client + chat() + classifyArgument()
  prompts.ts             # All system-prompt engineering
  store.ts               # zustand debate store
  json.ts                # Robust JSON extraction from LLM output
```

## Run it locally

### 1. Get a free Groq API key
Create one at <https://console.groq.com/keys> (free, no credit card). Groq is fast and has generous limits — ideal for a live demo.
*(Alternatively, use a free Hugging Face **Read** token from <https://huggingface.co/settings/tokens> and set `LLM_PROVIDER=hf`.)*

### 2. Configure env
```bash
cp .env.example .env.local
# then edit .env.local and paste your key:
# GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Install & run
```bash
npm install
npm run dev
```
Open <http://localhost:3000>.

> **Resilience:** `chat()` retries transient errors (rate-limit / "model busy") with backoff and **falls back across several open instruct models** so a demo never dead-ends on one model's capacity. Hard failures (bad key, exhausted quota) surface as a clean, human-readable message instead of a 500. Pin the primary model without touching code via `GROQ_CHAT_MODEL` (e.g. `llama-3.1-8b-instant`).

## Deploy (Vercel)

1. Push this repo to GitHub (public).
2. Import it into [Vercel](https://vercel.com/new).
3. Add the env var **`GROQ_API_KEY`** (and optionally `GROQ_CHAT_MODEL`) in Project Settings → Environment Variables.
4. Deploy. Vercel auto-detects Next.js.

## Judging rubric fit

- **Educational impact** — targets active-recall's weakness: it forces defense, cross-examination, and gap-finding, then tells you what to study.
- **Creative use of AI/ML** — two models in a feedback loop (generative opponent + a separate argument classifier driving adaptation), not a single-prompt chatbot.
- **Technical execution** — end-to-end functional, real model calls, adaptive prompting, provider fallback, resilient JSON parsing, mobile-friendly UI.
- **Pitch & demo** — the debrief screen is the money shot: Debate Score, strengths, unaddressed counterarguments, and next readings.

## License

MIT — built for a hackathon, use it however helps you learn.
