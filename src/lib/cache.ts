import type { PicksPayload } from "./types";

/**
 * In-memory cache for the current day's picks, keyed by `${sport}:${date}`.
 *
 * This is deliberately the only "storage" in the app — no database. It lives in
 * the serverless function's module scope, so it RESETS on every cold start and
 * on every redeploy, and separate concurrent instances each keep their own copy.
 * That means an occasional duplicate generation (and a duplicate API charge) is
 * possible. For a single-user daily tool that is fine: the point is only to stop
 * repeated clicks in one sitting from burning extra Anthropic calls.
 */
const cache = new Map<string, PicksPayload>();

/**
 * Requests that are mid-flight. Two clicks a few seconds apart would otherwise
 * both miss the cache and both call the API; instead the second one awaits the
 * first.
 */
const inFlight = new Map<string, Promise<PicksPayload>>();

const keyFor = (sport: string, date: string) => `${sport}:${date}`;

export function getCached(sport: string, date: string): PicksPayload | undefined {
  return cache.get(keyFor(sport, date));
}

/**
 * Returns the cached payload, the result of an already-running generation, or
 * runs `generate` and caches the result.
 */
export async function withDayCache(
  sport: string,
  date: string,
  generate: () => Promise<PicksPayload>,
): Promise<PicksPayload> {
  const key = keyFor(sport, date);

  const cached = cache.get(key);
  if (cached) return { ...cached, cached: true };

  const pending = inFlight.get(key);
  if (pending) return { ...(await pending), cached: true };

  const promise = generate();
  inFlight.set(key, promise);
  try {
    const payload = await promise;
    cache.set(key, payload);
    // Keep memory bounded if the instance somehow lives across many days.
    if (cache.size > 14) cache.delete(cache.keys().next().value as string);
    return payload;
  } finally {
    inFlight.delete(key);
  }
}
