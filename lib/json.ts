/**
 * Best-effort extraction of a JSON object from an LLM response.
 * Open models sometimes wrap JSON in prose or ```json fences; this pulls the
 * first balanced {...} block and parses it.
 */
export function extractJson<T = any>(text: string): T {
  if (!text) throw new Error("Empty model response.");

  // Strip common code fences.
  let s = text.trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

  // Fast path.
  try {
    return JSON.parse(s) as T;
  } catch {
    /* fall through */
  }

  // Find the first balanced { ... } block.
  const start = s.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in model response.");

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
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = s.slice(start, i + 1);
        return JSON.parse(candidate) as T;
      }
    }
  }
  throw new Error("Could not parse JSON from model response.");
}
