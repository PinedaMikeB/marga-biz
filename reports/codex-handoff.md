# Codex Handoff

Updated: 2026-03-31

## What Transfers Cleanly

- Git repo state from `main`
- site code and generated `dist`
- Telegram bridge scripts

## What Does Not Transfer Automatically

- this current Codex chat thread
- local secrets in `.env.local`
- local temp state in `temp/`
- local Codex automations on this Mac unless copied manually

## Resume Files

Use these first on the other Mac:

- `AGENTS.md`
- `automations/README.md`
- `reports/codex-handoff.md`
- `reports/telegram-bridge/inbox.md`

## Setup On The Other Mac

1. Pull latest repo:
   - `git pull origin main`
2. Recreate local env:
   - copy `.env.local` manually
   - or add fresh values for:
     - `TELEGRAM_BOT_TOKEN`
     - `TELEGRAM_CHAT_ID`
3. Verify scripts:
   - `npm run telegram:bot`
   - `npm run telegram:discover`
   - `npm run telegram:send -- --text="test"`
4. If needed, copy Codex automations from:
   - `~/.codex/automations/`

## Current Workflow

- Telegram bridge and chat daemon remain active in this repo.
- SEO automation and email automation were removed from the repo on 2026-03-31.
- Do not expect morning SEO review or email-monitor artifacts to keep updating unless those systems are reintroduced.

## Current Next Focus

- keep Telegram chat tooling stable while other automation is reintroduced selectively

## Notes

- if the other Mac runs the always-on daemon, it can become the main Telegram bridge host
- the repo is the source of truth for project state
- the chat thread is not the source of truth; use the repo files above
