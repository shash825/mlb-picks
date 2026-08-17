/**
 * Sport registry.
 *
 * Everything sport-specific lives here so adding a second sport is a new entry
 * in SPORTS plus (optionally) a sport selector in the UI — not a rewrite.
 * The API route, cache, prompt assembly, and rendering are all sport-agnostic.
 */

export type SportConfig = {
  /** URL/cache key. */
  id: string;
  /** Display name shown in the UI and used in the prompt. */
  label: string;
  /** Full name, to disambiguate for the model. */
  fullName: string;
  /**
   * IANA timezone the league schedules by. Used to decide what "today" is, so a
   * late-night click doesn't roll over to tomorrow's slate.
   */
  timezone: string;
  /**
   * Sport-specific research checklist and vocabulary. Kept separate from the
   * generic betting instructions in prompt.ts.
   */
  researchNotes: string;
  /**
   * Human labels for the four bet-type buckets. The buckets themselves are
   * generic (moneyline / spread / total / player prop) across most sports.
   */
  betTypeLabels: Record<string, string>;
};

export const SPORTS: Record<string, SportConfig> = {
  mlb: {
    id: "mlb",
    label: "MLB",
    fullName: "Major League Baseball",
    timezone: "America/New_York",
    researchNotes: [
      "REQUIRED: confirm today's slate, start times, and the announced starting pitchers. A preview or probable-pitchers roundup usually gets all three in one search.",
      "REQUIRED: get current moneyline, run line, and total prices. An odds page covering the whole slate is one search; note any line that has moved meaningfully from open.",
      "For the two or three games you are actually considering: the starters' recent form and relevant handedness splits, plus confirmed or projected lineups and any injury or late scratch.",
      "If a total is in play: ballpark factors and today's weather at that park — wind direction and speed matter most, then rain risk.",
      "If a bullpen-dependent angle is in play: pen usage over the last 2-3 days.",
      "If a player prop is in play: verify the player is expected to start and check him against the opposing starter.",
    ].join("\n"),
    betTypeLabels: {
      moneyline: "Moneyline",
      run_line: "Run Line",
      total: "Total",
      player_prop: "Player Prop",
    },
  },
};

export const DEFAULT_SPORT = "mlb";

export function getSport(id: string | null | undefined): SportConfig | null {
  return SPORTS[(id ?? DEFAULT_SPORT).toLowerCase()] ?? null;
}
