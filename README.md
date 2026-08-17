# Daily MLB Best Picks

A one-button personal tool: click **Get Today's Picks** and Claude researches today's MLB slate live — schedule, starting pitchers, lineups, injuries, weather, current betting lines — and returns 3–5 picks with reasoning and a confidence level.

The only paid dependency is your Anthropic API key.

> **These picks are AI-generated for informational and entertainment purposes only.** They are not betting advice, not guaranteed, and no outcome is promised. Bet responsibly, only what you can afford to lose, and only where sports betting is legal for you.

---

## How it works

- **Frontend** (`src/app/page.tsx`) — one page: password gate, a button, a loading state, and the results.
- **API route** (`src/app/api/picks/route.ts`) — does the actual work. Calls Claude with the server-side web search tool and returns validated JSON.
- **One run per day, by design.** After a successful generation the button retires for the session and the card stays on screen. There is no regenerate control — a second run costs a second API call, and the whole point is one card a day, taken before first pitch.
- **No database.** The only storage is an in-memory cache of the current day's card, which resets on cold start and on redeploy. It's a backstop for a page refresh within the same warm window, not a durable lock — the real guarantee is the retired button plus using this once a day as intended.
- **Your API key never touches the browser.** It's read from a server-side environment variable inside the API route only.

---

## Setup

### 1. Local

```bash
npm install
```

Create a `.env.local` in the project root (it's gitignored — never commit real secrets):

```
ANTHROPIC_API_KEY=sk-ant-your-real-key
APP_PASSWORD=whatever-you-want
```

See `.env.example` for the same list.

```bash
npm run dev
```

Open http://localhost:3000, enter your `APP_PASSWORD`, and click the button.

### 2. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new), **Import** that repo. Vercel auto-detects Next.js — no build settings to change.
3. Before (or right after) the first deploy, go to **Project → Settings → Environment Variables** and add both:
   - `ANTHROPIC_API_KEY`
   - `APP_PASSWORD`

   Add them to **Production**, **Preview**, and **Development** so every environment works.
4. Redeploy if you added the variables after the first build (**Deployments → ⋯ → Redeploy**). Environment variables are baked in at deploy time.

### Changing the password

Edit `APP_PASSWORD` in **Vercel → Settings → Environment Variables**, then redeploy. Locally, edit `.env.local` and restart `npm run dev`. It is never hardcoded anywhere in the source.

---

## ⚠️ About cost — web search is not free

Each run uses the Anthropic **web search tool**, and **every search Claude performs is billed separately from normal token costs**. At current pricing that's about **$10 per 1,000 searches**, and this app allows up to **10 searches per run** — roughly **$0.10 per generation** in search fees, plus a few cents of tokens.

So it is still "just the Anthropic key," but a run isn't free. Used as intended — one click a day, before games start — that's roughly **$3–5 a month**. Three things keep it in check:

- **The button retires after a successful run**, so you can't accidentally pay twice in one sitting. It stays available after an *error*, since a failed run produced nothing to keep.
- The in-memory day cache absorbs a page refresh within the same warm window.
- The search budget is a single constant: `MAX_SEARCHES` in `src/lib/claude.ts`. Lower it to spend less (at the cost of shallower research); raise it for more thorough cards.

**The one way to overspend** is to reload the page later in the day and click again. The card is not stored anywhere durable, so a reload after the serverless instance goes cold gives you a fresh button and a fresh charge. If you ever want a hard lock instead of a soft one, that needs a persistence layer (Upstash Redis or Vercel Blob, both one-click and free-tier in the Vercel dashboard) — ask and it's about fifteen lines.

Check real usage in the [Anthropic Console](https://console.anthropic.com/settings/usage).

---

## Deploying: the commit-email trap

Vercel refuses to deploy a commit whose author email it cannot match to a GitHub account. It reports this as **"Deployment Blocked"** in the dashboard, but from the CLI the deployment just sits at *"building"* forever with no logs and no error — easy to mistake for a Vercel outage. This cost an afternoon once.

This repo guards against it two ways:

- `git config user.email` is set to `255017126+shash825@users.noreply.github.com` (GitHub's no-reply address for the account, which always matches and doesn't expose a personal address).
- `.githooks/pre-commit` refuses to create a commit if that email ever changes.

The hook is versioned but Git needs to be told where to find it. **After a fresh clone, run:**

```bash
git config core.hooksPath .githooks
```

If a deployment ever hangs on "building" again, check the Vercel dashboard's deployment page first — the CLI will not tell you it was blocked.

## Notes and gotchas

**Runs take a while.** A full research pass is typically 1–3 minutes. The API route sets `maxDuration = 300` (5 minutes). Vercel caps function duration by plan — if you get a function timeout instead of picks, either upgrade the plan or lower `MAX_SEARCHES`.

**"Today" is US Eastern.** MLB schedules by ET and Vercel servers run UTC, so the date is resolved in `America/New_York` (`src/lib/sports.ts`). Without that, clicking after 8pm ET would ask for tomorrow's slate.

**The endpoint checks the password too.** The UI gate is convenience; `src/lib/auth.ts` verifies the password server-side on every request, so the API can't be called directly to skip the frontend.

**Model.** `claude-sonnet-5`, set in `src/lib/claude.ts`.

---

## Adding another sport later

The code is structured so this isn't a rewrite. Everything sport-specific lives in one place:

1. Add an entry to `SPORTS` in `src/lib/sports.ts` — id, display name, scheduling timezone, and a research checklist for that sport.
2. If the bet-type buckets need different labels, adjust `BET_TYPE_STYLES` in `src/app/page.tsx`. The four generic buckets (moneyline / spread / total / player prop) already map onto most sports.
3. Add a sport selector in the UI, or just change `DEFAULT_SPORT`.

The API route already takes `?sport=<id>`, and the cache, prompt assembly, validation, and rendering are all sport-agnostic.

---

## Project layout

```
src/
  app/
    page.tsx              UI: gate, button, loading, results, disclaimer
    layout.tsx
    globals.css
    api/
      unlock/route.ts     validates the password without spending an API call
      picks/route.ts      auth → cache → generate → validated JSON
  lib/
    sports.ts             sport registry (the extension point)
    prompt.ts             system + user prompts and the JSON contract
    claude.ts             Anthropic call, web search, parsing, validation
    cache.ts              in-memory day cache
    auth.ts               server-side password check
    date.ts               timezone-correct "today"
    types.ts              shared types
```
