import { checkPassword } from "@/lib/auth";
import type { ApiError } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Validates the shared password without generating anything, so entering the
 * password in the UI doesn't cost an API call.
 */
export async function POST(request: Request) {
  const auth = checkPassword(request);
  if (!auth.ok) {
    const body: ApiError = { error: auth.message, code: auth.code };
    return Response.json(body, { status: auth.code === "unauthorized" ? 401 : 500 });
  }
  return Response.json({ ok: true });
}
