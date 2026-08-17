"use client";

import { useEffect, useRef, useState } from "react";
import { formatDisplayDate, formatTimeInZone } from "@/lib/date";
import { SPORTS, DEFAULT_SPORT } from "@/lib/sports";
import type { ApiError, Confidence, Pick, PicksPayload } from "@/lib/types";

const PASSWORD_HEADER = "x-app-password";
const SPORT = SPORTS[DEFAULT_SPORT];

export default function Home() {
  // Unlock state lives in memory for the session only - no cookies, no storage.
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<PicksPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    if (!password.trim() || unlocking) return;

    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { [PASSWORD_HEADER]: password },
      });
      if (res.ok) {
        setUnlocked(true);
      } else {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        setError(body?.error ?? "Could not verify that password.");
      }
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setUnlocking(false);
    }
  }

  async function handleGetPicks() {
    // One run per day, by design. The button is retired after a successful
    // generation so a stray second click can't trigger another paid run. It
    // stays available after an error, since a failed run produced nothing.
    if (loading || payload) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/picks?sport=${SPORT.id}`, {
        method: "POST",
        headers: { [PASSWORD_HEADER]: password },
      });

      if (!res.ok) {
        // A gateway timeout returns Vercel's HTML error page, not our JSON, so
        // there's no body to read — say what actually happened instead of
        // surfacing a bare status code.
        if (res.status === 504 || res.status === 502) {
          setError(
            "The research run hit the 5-minute server limit before finishing. The searches it already ran still cost money, so don't just hammer retry - if this keeps happening, lower MAX_SEARCHES in src/lib/claude.ts.",
          );
          return;
        }

        const body = (await res.json().catch(() => null)) as ApiError | null;
        if (body?.code === "unauthorized") {
          setUnlocked(false);
          setPayload(null);
        }
        setError(body?.error ?? `Request failed (${res.status}). Try again.`);
        return;
      }

      setPayload((await res.json()) as PicksPayload);
    } catch {
      setError(
        "The request failed or timed out before picks came back. Research runs can take a few minutes - try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-16">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400/80">
          {SPORT.label} &middot; Daily Card
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Today&apos;s Best Picks
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Generated fresh by Claude, using live web research on today&apos;s
          schedule, pitchers, lineups, injuries, weather, and market prices.
        </p>
      </header>

      {!unlocked ? (
        <UnlockForm
          password={password}
          setPassword={setPassword}
          unlocking={unlocking}
          onSubmit={handleUnlock}
          error={error}
        />
      ) : (
        <section>
          {!payload ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGetPicks}
                disabled={loading}
                className="rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Researching..." : "Get Today's Picks"}
              </button>
              {!loading ? (
                <span className="text-xs text-slate-500">
                  One run per day &mdash; each run costs an API call.
                </span>
              ) : null}
            </div>
          ) : null}

          {loading ? <LoadingState /> : null}
          {error && !loading ? <ErrorState message={error} /> : null}
          {payload && !loading && !error ? <Results payload={payload} /> : null}
        </section>
      )}

      <Disclaimer />
    </main>
  );
}

function UnlockForm({
  password,
  setPassword,
  unlocking,
  onSubmit,
  error,
}: {
  password: string;
  setPassword: (value: string) => void;
  unlocking: boolean;
  onSubmit: (event: React.FormEvent) => void;
  error: string | null;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-ink-700 bg-ink-900 p-5"
    >
      <label htmlFor="password" className="block text-sm font-medium text-slate-300">
        Password
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter password"
          className="w-full rounded-lg border border-ink-700 bg-ink-950 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={unlocking || !password.trim()}
          className="shrink-0 rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {unlocking ? "Checking..." : "Unlock"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
    </form>
  );
}

function LoadingState() {
  const [seconds, setSeconds] = useState(0);
  const started = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(
      () => setSeconds(Math.round((Date.now() - started.current) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-6 rounded-xl border border-ink-700 bg-ink-900 p-6">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-400" />
        <p className="text-sm font-medium text-slate-200">
          Claude is researching today&apos;s slate...
        </p>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        This runs live web searches on the schedule, starters, lineups, injuries,
        weather, and current lines. It usually takes one to three minutes.
      </p>
      <p className="mt-3 text-xs tabular-nums text-slate-600">{seconds}s elapsed</p>
      <div className="mt-5 space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg bg-ink-800"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-xl border border-rose-900/60 bg-rose-950/30 p-5">
      <p className="text-sm font-semibold text-rose-300">Couldn&apos;t get picks</p>
      <p className="mt-1.5 text-sm text-rose-200/80">{message}</p>
    </div>
  );
}

function Results({ payload }: { payload: PicksPayload }) {
  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-700 pb-3">
        <h2 className="text-lg font-semibold text-slate-100">
          Picks for {formatDisplayDate(payload.date)}
        </h2>
        <p className="text-xs text-slate-500">
          {payload.picks.length} {payload.picks.length === 1 ? "pick" : "picks"}
          {payload.searchCount ? ` · ${payload.searchCount} web searches` : ""}
        </p>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Generated {formatTimeInZone(payload.generatedAt, SPORT.timezone)}
        {payload.cached ? " (cached earlier today)" : ""} &middot; that&apos;s
        today&apos;s run. Lineups and lines move after this, so check anything
        close before you act on it. Come back tomorrow for a fresh card.
      </p>

      {payload.summary ? (
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {payload.summary}
        </p>
      ) : null}

      {payload.picks.length === 0 ? (
        <div className="mt-6 rounded-xl border border-ink-700 bg-ink-900 p-6">
          <p className="text-sm font-medium text-slate-200">No picks today.</p>
          <p className="mt-1.5 text-sm text-slate-400">
            Either there are no games on the slate, or nothing cleared the bar
            worth backing. A blank card is a valid answer.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {payload.picks.map((pick) => (
            <PickCard key={pick.id} pick={pick} />
          ))}
        </ul>
      )}
    </div>
  );
}

const BET_TYPE_STYLES: Record<string, { label: string; className: string }> = {
  moneyline: {
    label: "Moneyline",
    className: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  },
  run_line: {
    label: "Run Line",
    className: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  },
  total: {
    label: "Total",
    className: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
  },
  player_prop: {
    label: "Player Prop",
    className: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30",
  },
};

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  High: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  Low: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
};

function PickCard({ pick }: { pick: Pick }) {
  const betType = BET_TYPE_STYLES[pick.betType] ?? {
    label: pick.betType,
    className: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  };

  return (
    <li className="rounded-xl border border-ink-700 bg-ink-900 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${betType.className}`}
        >
          {betType.label}
        </span>
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${CONFIDENCE_STYLES[pick.confidence]}`}
        >
          {pick.confidence} confidence
        </span>
      </div>

      {pick.matchup ? (
        <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
          {pick.matchup}
          {pick.subject && pick.subject !== pick.matchup
            ? ` · ${pick.subject}`
            : ""}
        </p>
      ) : null}

      <p className="mt-1.5 text-lg font-semibold text-slate-50">{pick.pick}</p>

      {pick.line ? (
        <p className="mt-1 text-sm text-slate-400">
          Typical line: <span className="tabular-nums">{pick.line}</span>
          <span className="text-slate-600"> &middot; varies by book</span>
        </p>
      ) : null}

      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        {pick.reasoning}
      </p>
    </li>
  );
}

function Disclaimer() {
  return (
    <footer className="mt-12 rounded-xl border border-amber-900/50 bg-amber-950/20 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
        Disclaimer
      </p>
      <p className="mt-2 text-sm leading-relaxed text-amber-100/80">
        These picks are AI-generated for informational and entertainment purposes
        only. They are not betting advice, they are not guaranteed, and no outcome
        is promised. The model can be wrong about lineups, injuries, lines, and
        everything else &mdash; verify anything before acting on it. Bet
        responsibly, only what you can afford to lose, and only where sports
        betting is legal for you. If gambling is causing harm, call 1-800-GAMBLER.
      </p>
    </footer>
  );
}
