# ailysis — UI

Mobile-first (iPhone vertical) front-end for **ailysis**, an autonomous stock-picking
agent board. Built with Vite + React, no chart library — everything is hand-rolled SVG/CSS.

> All numbers, orders and agent discussions are **fake demo data**. Not investment advice.

## What's in here

- **Intro** — "Think Less" / spinning globe with *ailysis* / "Profit More" (tap to skip).
- **Screen 1 — Portfolio** — live NYSE open/closed countdown, hero portfolio chart (~70%
  of the screen) and daily / weekly / monthly performance below.
- **Screen 2** (swipe down, TikTok-style one-swipe paging) — **Order history**
  (name · price · qty · P/L on one line) plus two donut charts: industry allocation
  (left) and asset class (right).
- **Board chat** — tap any order to open a WhatsApp-style group chat where the agents
  (Value, Momentum, Growth, Quant, Risk) debate and the Moderator runs a buy vote.

## Run locally

```bash
npm install
npm run dev
```

## Deploy on Vercel

This is a standard Vite app — Vercel auto-detects it.

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

Push this repo to GitHub, import it in Vercel, deploy, then open the URL on your iPhone.
Add it to the Home Screen for the full full-screen experience.
