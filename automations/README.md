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

## SEO Monitor Viewer

- Viewer source: `automations/seo-monitor/`
- Published path after build: `/automations/seo-monitor/`
- Report endpoint: `/.netlify/functions/seo-monitor-report`
- Action endpoint: `/.netlify/functions/seo-monitor-actions`
- Current role: printer-focused SEO monitor with a manual task runner backed by Firebase data
- Completion tracking: completed page/blog implementations can be recorded and reflected as `Done` with the live URL in the queue
- Email helper for automation summaries: `scripts/send-email-report.js`
- Daily execution rule: do not treat the queue as a recommendation list at turnover time; the intended end-of-run state is that all daily SEO tasks are either `Done` with live URLs or explicitly `Blocked` with a real reason
- Scope guardrail: do not use this viewer to automate changes against the home page or copier-rental pages

## Local Scheduling / Daemons

- Launchd files:
  - `ops/telegram-chat-daemon.plist`

## Important Note

Codex desktop recurring automation definitions are not stored in this repo by default. Those scheduler files live in Codex app storage.

SEO automation and email automation were removed from this repo on 2026-03-31. Telegram chat tooling remains active here. The SEO monitor viewer added later is an on-demand tool, not a background daemon defined in this repo. A local email send helper may be used by Codex automations when explicitly configured.
