/** Shared shapes between the API route and the UI. */

export const BET_TYPES = ["moneyline", "run_line", "total", "player_prop"] as const;
export type BetType = (typeof BET_TYPES)[number];

export const CONFIDENCE_LEVELS = ["High", "Medium", "Low"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export type Pick = {
  /** Stable-ish key for React lists. Generated server-side. */
  id: string;
  betType: BetType;
  /** "Away Team @ Home Team" — the game the bet lives in. */
  matchup: string;
  /** Team or player the bet is actually on. */
  subject: string;
  /** The bet itself, e.g. "Dodgers -1.5" or "Aaron Judge over 1.5 total bases". */
  pick: string;
  /** Typical market line/odds, or null if the model could not find one. */
  line: string | null;
  confidence: Confidence;
  /** Short plain-English rationale. */
  reasoning: string;
};

export type PicksPayload = {
  /** Display name of the sport, e.g. "MLB". */
  sport: string;
  /** YYYY-MM-DD in the sport's scheduling timezone. */
  date: string;
  /** ISO timestamp of when this card was generated. Shown in the UI so a card
   *  built before lineups dropped is recognizable as stale. */
  generatedAt: string;
  /** One or two sentences on the slate overall. May explain a thin/empty day. */
  summary: string;
  picks: Pick[];
  /** True when this response came from the in-memory day cache. */
  cached: boolean;
  /** How many web searches Claude ran, when the API reports it. */
  searchCount: number | null;
};

export type ApiError = {
  error: string;
  /** Machine-readable so the UI can react (e.g. re-lock on auth failure). */
  code:
    | "unauthorized"
    | "not_configured"
    | "rate_limited"
    | "upstream_error"
    | "bad_response"
    | "unknown";
};
