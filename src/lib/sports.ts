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
      "Confirm the full slate of games and their start times.",
      "Identify the announced starting pitchers for both sides of every game you consider, and check their recent form (last 3-5 starts), season-long peripherals, and any handedness splits that matter.",
      "Check today's confirmed or projected lineups, plus the injured list and any late scratches.",
      "Check bullpen availability and usage over the last 2-3 days — a gassed pen changes late-game and totals value.",
      "Check ballpark factors and today's weather at the park, especially wind direction and speed for totals, and any rain risk.",
      "Check current moneyline, run line, and total prices, and note whether a line has moved meaningfully from open.",
      "For player props, verify the player is actually expected to start and check the matchup against the opposing starter.",
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
