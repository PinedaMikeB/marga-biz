# Codex Handoff

Updated: 2026-03-16

## What Transfers Cleanly

- Git repo state from `main`
- site code and generated `dist`
- tracker and roadmap files
- SERP monitoring scripts
- Telegram bridge scripts
- morning review scripts

## What Does Not Transfer Automatically

- this current Codex chat thread
- local secrets in `.env.local`
- local temp state in `temp/`
- local Codex automations on this Mac unless copied manually

## Resume Files

Use these first on the other Mac:

- `reports/location-seo-tracker.md`
- `reports/location-ranking-roadmap.md`
- `reports/morning-seo-review/latest.md`
- `reports/morning-seo-review/approval-status.md`
- `reports/telegram-bridge/inbox.md`

## Setup On The Other Mac

1. Pull latest repo:
   - `git pull origin main`
2. Recreate local env:
   - copy `.env.local` manually
   - or add fresh values for:
     - `SERPAPI_KEY`
     - `TELEGRAM_BOT_TOKEN`
     - `TELEGRAM_CHAT_ID`
3. Verify scripts:
   - `npm run build`
   - `npm run telegram:bot`
   - `npm run seo:morning-review`
4. If needed, copy Codex automations from:
   - `~/.codex/automations/`

## Current Workflow

- morning review prepares the SEO brief and sends Telegram approval
- approval status script checks whether the request is approved
- only one approved action should be executed at a time
- all verified work should be committed and pushed to `main` immediately

## Current Next Approved Candidate

- `build Pasig money page`

## Notes

- if the other Mac runs the always-on daemon, it can become the main Telegram bridge host
- the repo is the source of truth for project state
- the chat thread is not the source of truth; use the tracker and roadmap files
