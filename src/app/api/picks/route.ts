import { checkPassword } from "@/lib/auth";
import { withDayCache } from "@/lib/cache";
import { PicksError, generatePicks } from "@/lib/claude";
import { todayInZone } from "@/lib/date";
import { DEFAULT_SPORT, getSport } from "@/lib/sports";
import type { ApiError } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A research run can take a couple of minutes. Vercel hard-kills the function
 * at this limit and returns a 504, so MAX_SEARCHES and EFFORT in lib/claude.ts
 * are tuned to finish well inside it. Raising this above your plan's cap does
 * nothing.
 */
export const maxDuration = 300;

/**
 * Both actions live in one route, so the app ships one serverless function
 * instead of two identical ones:
 *
 *   POST /api/picks?action=unlock  -> validate the password only (free)
 *   POST /api/picks                -> generate today's card (costs an API call)
 *
 * Note: this does NOT make `vercel build` work on Windows without Developer
 * Mode. Next still emits deduped internal error pages that Vercel symlinks, and
 * symlink creation is what fails there. Build on Vercel, or enable Developer
 * Mode if you want local prebuilt deploys.
 */
export async function POST(request: Request) {
  const auth = checkPassword(request);
  if (!auth.ok) {
    return fail(auth.message, auth.code, auth.code === "unauthorized" ? 401 : 500);
  }

  const params = new URL(request.url).searchParams;

  // Password-check only. Lets the UI gate open without spending anything.
  if (params.get("action") === "unlock") {
    return Response.json({ ok: true });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return fail(
      "ANTHROPIC_API_KEY is not set on the server. Add it in your Vercel project settings (or .env.local) and redeploy.",
      "not_configured",
      500,
    );
  }

  const sportId = params.get("sport") ?? DEFAULT_SPORT;
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
