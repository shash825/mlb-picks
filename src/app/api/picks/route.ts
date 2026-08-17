import { checkPassword } from "@/lib/auth";
import { withDayCache } from "@/lib/cache";
import { PicksError, generatePicks } from "@/lib/claude";
import { todayInZone } from "@/lib/date";
import { DEFAULT_SPORT, getSport } from "@/lib/sports";
import type { ApiError } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A full research run (up to 10 web searches plus reasoning) can take a few
 * minutes. Vercel caps this by plan — see the README if you get a function
 * timeout instead of picks.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = checkPassword(request);
  if (!auth.ok) {
    return fail(auth.message, auth.code, auth.code === "unauthorized" ? 401 : 500);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return fail(
      "ANTHROPIC_API_KEY is not set on the server. Add it in your Vercel project settings (or .env.local) and redeploy.",
      "not_configured",
      500,
    );
  }

  const sportId = new URL(request.url).searchParams.get("sport") ?? DEFAULT_SPORT;
  const sport = getSport(sportId);
  if (!sport) {
    return fail(`Unknown sport "${sportId}".`, "unknown", 400);
  }

  const date = todayInZone(sport.timezone);

  try {
    const payload = await withDayCache(sport.id, date, () =>
      generatePicks(sport, date),
    );
    return Response.json(payload);
  } catch (err) {
    if (err instanceof PicksError) {
      return fail(err.message, err.code, err.code === "rate_limited" ? 429 : 502);
    }
    console.error("Unexpected error generating picks:", err);
    return fail("Something went wrong generating picks. Try again.", "unknown", 500);
  }
}

function fail(error: string, code: ApiError["code"], status: number) {
  const body: ApiError = { error, code };
  return Response.json(body, { status });
}
