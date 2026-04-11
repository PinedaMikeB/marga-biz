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

## Marketing Automation

- Workspace: `automations/marketing-automation/`
- Orchestrator: `automations/marketing-automation/orchestrator.js`
- Workers:
  - `automations/marketing-automation/workers/research-agent.js`
  - `automations/marketing-automation/workers/campaign-planner.js`
  - `automations/marketing-automation/workers/creative-agent.js`
  - `automations/marketing-automation/workers/copy-agent.js`
  - `automations/marketing-automation/workers/distribution-agent.js`
  - `automations/marketing-automation/workers/performance-analyst.js`
- Output reports:
  - `automations/marketing-automation/reports/orchestrator/latest.md`
  - `automations/marketing-automation/reports/orchestrator/latest.json`
  - `automations/marketing-automation/reports/performance-analyst/latest.md`
  - `automations/marketing-automation/reports/performance-analyst/latest.json`
- Current role: generate campaign research, planning, creative direction, copy, distribution manifests, and performance recommendations inside one safe on-demand pipeline
- Current mode: on-demand helper, not a background daemon

## SEO Monitor Viewer

- Viewer source: `automations/seo-monitor/`
- Published path after build: `/automations/seo-monitor/`
- Report endpoint: `/.netlify/functions/seo-monitor-report`
- Action endpoint: `/.netlify/functions/seo-monitor-actions`
- Current role: printer-focused SEO monitor with a manual task runner backed by Firebase data
- Completion tracking: completed page/blog implementations can be recorded and reflected as `Done` with the live URL in the queue
- Goal model: the monitor should show progress toward owning the core `printer rental` keywords and expose the ranking and competitor gaps that still need implementation work
- Copier model: monitor the protected copier winners and the home-page-carried copier terms without editing them; use automation only for copier location growth pages and supporting copier content
- Daily production rule: keep `2` new pages and `5` supporting blogs as fixed output targets; let the other SEO tasks expand or contract based on ranking distance and competitor-gap findings
- Daily research loop: competitor research and gap-finding is a non-stop daily cycle, not a one-time setup step
- Email helper for automation summaries: `scripts/send-email-report.js` using SMTP-only local env delivery
- Shared local env fallback for worktrees: `~/.codex/env/marga-biz.env`
- Production deploy helper: `scripts/deploy-site.js`
- Automation preflight: `npm run automation:preflight -- --sync-main --strict`
- Scheduled automation root: `~/.codex/repos/marga-biz-automation`
- Local unsandboxed executor: `scripts/run-printer-seo-daily.js`
- Launchd scheduler tick: `scripts/printer-seo-scheduler.js`
- Launchd install helper: `ops/install-printer-seo-daily-launchd.sh`
- Daily execution rule: do not treat the queue as a recommendation list at turnover time; the intended end-of-run state is that all daily SEO tasks are either `Done` with live URLs or explicitly `Blocked` with a real reason
- Stale-state rule: if the executor sees a stale lock, stale task, stale run marker, or stale queue item, it must analyze and repair that state first, then continue the run. If repair is not safe or does not work, it should email the stale-task summary, record the blocker in the current report, and continue with the next runnable work instead of stopping the automation forever.
- Scope guardrail: do not use this viewer to automate changes against the home page or copier-rental pages
- If the Codex desktop scheduler reports sandboxed DNS or git-worktree errors, use the launchd executor as the authoritative automation path.

## Local Scheduling / Daemons

- Launchd files:
  - `ops/telegram-chat-daemon.plist`

## Important Note

Codex desktop recurring automation definitions are not stored in this repo by default. Those scheduler files live in Codex app storage.

SEO automation and email automation were removed from this repo on 2026-03-31. Telegram chat tooling remains active here. The SEO monitor viewer added later is an on-demand tool, not a background daemon defined in this repo. A local email send helper may be used by Codex automations when explicitly configured.
