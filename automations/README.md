# Automations

This folder is the repo-local index for automation work in `marga-biz`.

## Facebook Automation

- Publisher: `scripts/facebook-page-publisher.js`
- Latest preview/publish report:
  - `reports/facebook/latest.md`
  - `reports/facebook/latest.json`

## Telegram / Chat Automation

- Chat daemon: `scripts/telegram-chat-daemon.js`
- Shared gateway: `scripts/lib/telegram-gateway.js`
- Inbox report: `reports/telegram-bridge/inbox.md`

## Local Scheduling / Daemons

- Launchd files:
  - `ops/telegram-chat-daemon.plist`

## Important Note

Codex desktop recurring automation definitions are not stored in this repo by default. Those scheduler files live in Codex app storage.

SEO automation and email automation were removed from this repo on 2026-03-31. Telegram chat tooling remains active here.
