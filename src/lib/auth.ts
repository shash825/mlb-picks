import { timingSafeEqual } from "node:crypto";

/** Header the browser sends the shared password in. */
export const PASSWORD_HEADER = "x-app-password";

export type AuthResult =
  | { ok: true }
  | { ok: false; code: "not_configured" | "unauthorized"; message: string };

/**
 * Checks the shared password server-side. The UI gate is convenience only —
 * this is what actually stops someone from calling the endpoint directly.
 */
export function checkPassword(request: Request): AuthResult {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return {
      ok: false,
      code: "not_configured",
      message:
        "APP_PASSWORD is not set on the server. Add it in your Vercel project settings (or .env.local) and redeploy.",
    };
  }

  const supplied = request.headers.get(PASSWORD_HEADER) ?? "";
  return constantTimeEquals(supplied, expected)
    ? { ok: true }
    : { ok: false, code: "unauthorized", message: "Incorrect password." };
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, so compare against a fixed-size
  // digest-like padding: hash-free approach is fine here since length alone is
  // not a meaningful secret for a shared PIN.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
