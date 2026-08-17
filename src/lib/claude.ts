import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import type { SportConfig } from "./sports";
import { BET_TYPES, CONFIDENCE_LEVELS } from "./types";
import type { BetType, Confidence, Pick, PicksPayload } from "./types";

const MODEL = "claude-sonnet-5";

/**
 * Web search budget per run. NOTE: each search Claude performs is billed on your
 * Anthropic account IN ADDITION to normal token costs ($10 per 1,000 searches at
 * the time of writing). It is still "just the Anthropic key", but it is not free.
 *
 * This is ALSO the main lever on wall-clock time. Vercel kills the function at
 * 300s (see maxDuration in the picks route), and 10 searches at "high" effort
 * blew through that limit. Five keeps a full run comfortably inside the window.
 * Raise it only if runs are finishing fast — a run that times out costs you the
 * search fees and returns nothing.
 */
const MAX_SEARCHES = 4;

/**
 * Search tool variant. The newer "web_search_20260209" adds dynamic filtering,
 * which runs a server-side code-execution pass on every search. Measured cost
 * was roughly 60s per search — five of them consumed the entire 300s function
 * budget and returned nothing. The basic variant skips that pass and is the
 * reason a run now fits. Do not "upgrade" this without timing a real run.
 */
const SEARCH_TOOL = "web_search_20250305" as const;

/**
 * Thinking depth. "medium" is the cost/latency/quality balance point on Sonnet 5
 * and is roughly comparable to the previous generation at "high". Combined with
 * the search budget above, this is what keeps a run inside the 300s limit.
 */
const EFFORT = "low" as const;

/**
 * Give up before Vercel's 300s hard kill so the user gets our explanatory error
 * (and the timing log below) instead of an opaque 504 with no diagnostics.
 */
const DEADLINE_MS = 240_000;

/** Server-tool turns can pause; resume a bounded number of times. */
const MAX_CONTINUATIONS = 2;

export class PicksError extends Error {
  constructor(
    message: string,
    readonly code: "rate_limited" | "upstream_error" | "bad_response" | "unknown",
  ) {
    super(message);
  }
}

export async function generatePicks(
  sport: SportConfig,
  date: string,
): Promise<PicksPayload> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserPrompt(sport, date) },
  ];

  let response: Anthropic.Message;
  let searchCount = 0;
  const startedAt = Date.now();
  const elapsed = () => Math.round((Date.now() - startedAt) / 1000);

  try {
    for (let attempt = 0; ; attempt++) {
      // Streamed so a long research run (several minutes) can't trip the SDK's
      // HTTP timeout. We only need the assembled message at the end.
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        system: buildSystemPrompt(sport),
        output_config: { effort: EFFORT },
        tools: [
          {
            type: SEARCH_TOOL,
            name: "web_search",
            max_uses: MAX_SEARCHES,
          },
        ],
        messages,
      }, { signal: AbortSignal.timeout(DEADLINE_MS - (Date.now() - startedAt)) });

      response = await stream.finalMessage();
      searchCount += response.usage.server_tool_use?.web_search_requests ?? 0;

      // Timing lands in Vercel's runtime logs. If a run ever overruns again,
      // this says exactly how long it took and how many searches it burned,
      // instead of leaving us to guess.
      console.log(
        `[picks] attempt ${attempt} finished at ${elapsed()}s | searches=${searchCount} | stop=${response.stop_reason}`,
      );

      // The server-side search loop hit its iteration cap. Append the partial
      // assistant turn and re-send; the API picks up where it left off.
      if (response.stop_reason === "pause_turn" && attempt < MAX_CONTINUATIONS) {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      break;
    }
  } catch (err) {
    console.error(`[picks] failed at ${elapsed()}s | searches=${searchCount}`, err);
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new PicksError(
        `The research run was still going at ${elapsed()}s and was stopped before the server's hard limit. Lower MAX_SEARCHES in src/lib/claude.ts.`,
        "upstream_error",
      );
    }
    throw toPicksError(err);
  }

  if (response.stop_reason === "refusal") {
    throw new PicksError(
      "Claude declined to answer this request.",
      "upstream_error",
    );
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new PicksError(
      response.stop_reason === "max_tokens"
        ? "Claude ran out of room before finishing the card. Try again."
        : "Claude returned an empty response.",
      "bad_response",
    );
  }

  const parsed = parseJsonObject(text);
  if (!parsed) {
    throw new PicksError(
      "Claude's response was not valid JSON. Try again.",
      "bad_response",
    );
  }

  return {
    sport: sport.label,
    date,
    generatedAt: new Date().toISOString(),
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    picks: normalizePicks(parsed.picks),
    cached: false,
    searchCount: searchCount || null,
  };
}

function toPicksError(err: unknown): PicksError {
  if (err instanceof Anthropic.RateLimitError) {
    return new PicksError(
      "Anthropic rate limit hit. Wait a minute and try again.",
      "rate_limited",
    );
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new PicksError(
      "Anthropic rejected the API key. Check ANTHROPIC_API_KEY.",
      "upstream_error",
    );
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new PicksError(
      "Could not reach the Anthropic API. Check your connection and try again.",
      "upstream_error",
    );
  }
  if (err instanceof Anthropic.APIError) {
    return new PicksError(
      `Anthropic API error (${err.status ?? "unknown"}): ${err.message}`,
      "upstream_error",
    );
  }
  return new PicksError(
    err instanceof Error ? err.message : "Something went wrong generating picks.",
    "unknown",
  );
}

/**
 * Pull the JSON object out of the model's final text. The prompt asks for bare
 * JSON, but a stray fence or a trailing sentence shouldn't break the app.
 */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const candidates: string[] = [];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));

  candidates.push(text);

  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** Drop anything malformed rather than rendering half a card. Cap at 5. */
function normalizePicks(raw: unknown): Pick[] {
  if (!Array.isArray(raw)) return [];

  const picks: Pick[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;

    const betType = asBetType(p.betType);
    const confidence = asConfidence(p.confidence);
    const pick = asText(p.pick);
    const reasoning = asText(p.reasoning);
    if (!betType || !confidence || !pick || !reasoning) continue;

    picks.push({
      id: `${picks.length}-${betType}-${pick.slice(0, 40)}`,
      betType,
      matchup: asText(p.matchup) ?? "",
      subject: asText(p.subject) ?? "",
      pick,
      line: asText(p.line),
      confidence,
      reasoning,
    });
    if (picks.length === 5) break;
  }
  return picks;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBetType(value: unknown): BetType | null {
  return typeof value === "string" && (BET_TYPES as readonly string[]).includes(value)
    ? (value as BetType)
    : null;
}

function asConfidence(value: unknown): Confidence | null {
  if (typeof value !== "string") return null;
  const match = CONFIDENCE_LEVELS.find(
    (level) => level.toLowerCase() === value.trim().toLowerCase(),
  );
  return match ?? null;
}
