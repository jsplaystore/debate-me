# Debate Me 🥊

**An AI-powered adversarial learning tool for college students.**

You learn a concept most deeply when you're forced to _defend_ it — not just recall it. **Debate Me** puts you in a live, adversarial dialogue with an AI that argues the opposing side of any concept you're studying. It probes, challenges, and counters until you demonstrate genuine understanding. Make a factually wrong claim and it calls you out. Make a weak argument and it exploits it.

Built for an educational AI hackathon. 100% open-source models via the **Hugging Face Inference API** — no OpenAI, no Anthropic.

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
| **Debate opponent + debrief + reading analysis** | `meta-llama/Meta-Llama-3-8B-Instruct` (generative) | Produces adaptive, in-character counter-arguments and structured post-debate analysis. |
| **Argument-strength scoring** | `facebook/bart-large-mnli` (zero-shot classification) | Classifies each student turn as **strong / weak / off-topic / contains-factual-error**. |

The classifier's read is injected back into the generative model's system prompt every turn — so a *weak* turn makes the AI demand evidence, a *factual error* makes it call out the mistake, and a *strong* turn makes it escalate to a sharper counterexample. **A generative model + a classifier in a feedback loop is what makes the AI core to the product, not a chatbot wrapper.**

## Features

- **Adversarial Debate Engine** — pick a topic + side, the AI opens with a strong counter-argument, then a real-time back-and-forth (minimum 5 exchanges). One counter-argument + one probing question per turn, escalating in complexity: basic counterpoints → edge cases → steelman-then-dismantle.
- **Live Argument Strength indicator** — every turn you send is scored by BART-MNLI and shown with a confidence bar.
- **Adaptive opponent** — the AI targets whatever the classifier says is your weakness.
- **Structured debrief** — a 0–100 Debate Score, your strongest arguments (and why), the counterarguments you never addressed, and 3 topics to read next.
- **Topic Bootstrapper** — don't know enough to debate yet? Paste a reading (lecture notes, article, textbook excerpt) and the AI extracts the most debatable claims for you to pick from.
- **Zero friction** — no login, no database, mobile-friendly.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Hugging Face Inference API** via `@huggingface/inference`
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

### 1. Get a free Hugging Face token
Create one at <https://huggingface.co/settings/tokens> (a **Read** token is enough).

### 2. Configure env
```bash
cp .env.example .env.local
# then edit .env.local and paste your token:
# HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Install & run
```bash
npm install
npm run dev
```
Open <http://localhost:3000>.

> **Model availability:** the free serverless tier rotates which models are hot. If the default chat model isn't available at demo time, override it without touching code:
> ```
> HF_CHAT_MODEL=mistralai/Mixtral-8x7B-Instruct-v0.1
> ```
> Any chat-completion-capable instruct model works.

## Deploy (Vercel)

1. Push this repo to GitHub (public).
2. Import it into [Vercel](https://vercel.com/new).
3. Add the env var **`HF_TOKEN`** (and optionally `HF_CHAT_MODEL` / `HF_CLASSIFIER_MODEL`) in Project Settings → Environment Variables.
4. Deploy. Vercel auto-detects Next.js.

## Judging rubric fit

- **Educational impact** — targets active-recall's weakness: it forces defense, cross-examination, and gap-finding, then tells you what to study.
- **Creative use of AI/ML** — two models in a feedback loop (generative opponent + zero-shot classifier driving adaptation), not a single-prompt chatbot.
- **Technical execution** — end-to-end functional, real HF calls, adaptive prompting, resilient JSON parsing, mobile-friendly UI.
- **Pitch & demo** — the debrief screen is the money shot: Debate Score, strengths, unaddressed counterarguments, and next readings.

## License

MIT — built for a hackathon, use it however helps you learn.
