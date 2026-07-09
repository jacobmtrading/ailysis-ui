# ailysis

Autonomous paper-trading fund with an AI agent board, in one repo:

- **Frontend** — mobile-first (iPhone) Vite + React app: portfolio chart, order history, allocation, and WhatsApp-style board discussions.
- **Backend** — Vercel serverless functions: a zero-LLM scraper that finds ideas, an agent board (one DeepSeek call per decision) that debates and votes, and hourly portfolio tracking. State lives in Upstash Redis (free tier).

> Paper trading with fake money and real prices. Not investment advice.

## The board

| Agent | Style |
|---|---|
| **Max Momentum** | Trends + industry news; always ends with scenario outlooks and probabilities |
| **Valeria Value** | Fundamentals and valuation; argues only with numbers |
| **Kian Quant** | Pure chart/technical analysis (fed real price stats) |
| **Rayan Risk** | Strategist; position sizing, stops, industry caps (max 30% per industry — code-enforced) |
| **Emilia ETF** | Asset allocation; keeps the book near 50/50 ETFs vs stocks (code-enforced) |
| **The Moderator** | Calls the vote, announces the outcome |

## Cost design (deliberately cheap)

- Scraping, scoring, price updates, stop-losses, guardrails: **pure code, zero tokens**.
- One DeepSeek call generates an **entire** board discussion + vote + decision (JSON mode, capped tokens).
- Byte-stable system prompt → DeepSeek context caching discounts every call after the first.
- Hard caps: max board discussions per day (`BOARD_DAILY_MAX`, default 6), 7-day cooldown per ticker.
- Market data: free keyless CNBC quote API (whole portfolio in one batched request) with Stooq fallback.

## Deploy & setup

### 1. Vercel

Import this repo at [vercel.com/new](https://vercel.com/new) (framework: Vite, auto-detected).

### 2. Storage (Upstash Redis, free)

In the Vercel project: **Storage → Create Database → Upstash for Redis** (Marketplace) → free plan → connect to the project. This auto-adds `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_*` — both supported).

### 3. Environment variables (Project → Settings → Environment Variables)

| Name | Value |
|---|---|
| `DEEPSEEK_API_KEY` | your key from platform.deepseek.com |
| `CRON_SECRET` | any long random string — protects the cron endpoints |
| `BOARD_DAILY_MAX` | optional, default `6` |

Redeploy after adding env vars.

### 4. Cron (cron-job.org, free)

Create three jobs pointing at your deployment (replace `SECRET`):

| URL | Schedule |
|---|---|
| `https://<app>.vercel.app/api/cron/prices?token=SECRET` | Hourly at :05, Mon–Fri, 09:00–22:00 Berlin time |
| `https://<app>.vercel.app/api/cron/scrape?token=SECRET` | Every 20 min, Mon–Fri, 09:00–22:00 Berlin time |
| `https://<app>.vercel.app/api/cron/review?token=SECRET` | Once daily at 17:40 Berlin time, Mon–Fri |

The endpoints self-check market hours (Xetra 9:00–17:30 Berlin, NYSE 9:30–16:00 New York) and no-op when closed, so a generous schedule is safe.

### 5. Test it

- `/api/cron/prices?token=SECRET&force=1` → `{ ok: true, value: 100000 }`
- `/api/cron/scrape?token=SECRET&force=1` → runs the scraper; if a candidate is found, the board convenes and you'll see the discussion in the app.
- `/api/state` → the full portfolio state the app renders.

The app shows `· demo` next to the title until the backend has real data.

## Run frontend locally

```bash
npm install
npm run dev
```

Locally there is no `/api`, so the app falls back to bundled demo data.
