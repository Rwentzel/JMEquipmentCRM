/**
 * AI provider adapter — Anthropic Messages API via fetch (Node runtime only).
 *
 * SECURITY: the API key comes ONLY from the ANTHROPIC_API_KEY environment
 * variable — never from the repo, never from config files. When the key is
 * absent (the default sandbox state), every agent falls back to its
 * deterministic rules engine, so the whole product works with zero secrets
 * and zero outbound calls.
 *
 * DATA PROTECTION: callers must pass only public-safe or PII-stripped
 * content. The agents in src/lib/agents never place contact PII, vendor
 * data, cost, or margin into a prompt.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 20_000;

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface CompleteOptions {
  system: string;
  user: string;
  maxTokens?: number;
}

/**
 * One-shot completion. Returns the text answer, or null when the provider is
 * unconfigured or the call fails — callers treat null as "use the fallback".
 */
export async function complete(opts: CompleteOptions): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.JME_AI_MODEL || DEFAULT_MODEL,
        max_tokens: opts.maxTokens ?? 600,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text || null;
  } catch {
    return null; // network/timeout → fallback engine
  } finally {
    clearTimeout(timer);
  }
}
