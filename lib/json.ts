/**
 * Best-effort extraction of a JSON value from an LLM response.
 * Open models wrap JSON in prose, ```json fences, smart quotes, or trailing
 * commas. This is deliberately tolerant: it pulls the first balanced {...} or
 * [...] block and repairs the most common issues before parsing.
 */
export function extractJson<T = any>(text: string): T {
  if (!text) throw new Error("Empty model response.");

  const candidates: string[] = [];

  const trimmed = text.trim();
  candidates.push(trimmed);

  // 1) Fenced ```json ... ``` block anywhere in the text.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) candidates.push(fence[1].trim());

  // 2) First balanced {...} and first balanced [...] block.
  const obj = firstBalanced(trimmed, "{", "}");
  if (obj) candidates.push(obj);
  const arr = firstBalanced(trimmed, "[", "]");
  if (arr) candidates.push(arr);

  for (const c of candidates) {
    const parsed = tryParse<T>(c);
    if (parsed !== undefined) return parsed;
  }

  throw new Error("Could not parse JSON from model response.");
}

function tryParse<T>(raw: string): T | undefined {
  const attempts = [raw, repair(raw)];
  for (const a of attempts) {
    try {
      return JSON.parse(a) as T;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

/** Repair common LLM JSON defects. */
function repair(s: string): string {
  return s
    .replace(/[“”]/g, '"') // smart double quotes
    .replace(/[‘’]/g, "'") // smart single quotes
    .replace(/,\s*([}\]])/g, "$1") // trailing commas before } or ]
    .trim();
}

/** Return the first balanced bracketed block, respecting strings/escapes. */
function firstBalanced(s: string, open: string, close: string): string | null {
  const start = s.indexOf(open);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}
