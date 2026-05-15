# AllianceBot Worker

This package is the deployable Cloudflare Worker build for the archived tracker site.

## What it serves

- `/` and the static pages from `public/`
- `/api/scores` and `/api/live-scores` proxied to the bot
- `/api/tracker-state` proxied to the bot
- `/webhook/tradingview` proxied to the bot

## Deployment

Deploy with `wrangler deploy` from this folder.

Set `BOT_BASE` in the Worker environment to the separate persistent API origin. In the two-worker setup, this should be the Worker A URL from `alliancebot-api`.

The public Worker host and the persistent API host must not be the same origin. The front end uses same-origin `/api/scores` and `/api/tracker-state`, and the Worker forwards those requests to `BOT_BASE`.

The TradingView webhook URL shown in the UI is still controlled by the page itself. This package keeps that behavior unchanged; it only changes where the score and tracker-memory API requests are sent.
