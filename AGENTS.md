# AGENTS.md

Repo-specific instructions for Codex and automation working inside `marga-biz`.

## Purpose

- Use this file as the repo-level operating guide before making changes.
- Prefer this file for project rules that are not obvious from code alone.
- Global system and developer instructions still take precedence over this file.

## Current Automation Scope

- Telegram chat tooling remains active in this repo.
- SEO automation and email automation were intentionally removed from this repo on 2026-03-31.
- Do not assume SEO report generators, SERP monitors, or email-monitor daemons still exist unless they are reintroduced later.

## Source Of Truth

Check these files first before making Telegram or repo automation decisions:

- `AGENTS.md`
- `automations/README.md`
- `reports/codex-handoff.md`

For Telegram-related questions, also verify:

- `reports/telegram-bridge/inbox.md`

Do not rely on chat history alone when current repo files can answer the question.

## Telegram

- Shared Telegram helper lives in `scripts/lib/telegram-gateway.js`.
- Telegram status answers should verify files on disk before replying.
- Do not treat `reports/telegram-bridge/inbox.md` as a durable planning document. It is an activity log.
- Do not commit temp runtime state unless the user explicitly wants that behavior captured.

## Git Rules

- Commit only files relevant to the task you are pushing.
- Avoid bundling unrelated Facebook, Telegram, site, or other work into one commit.
- If the remote moved ahead, rebase cleanly and preserve unrelated local work.
- Do not commit secrets from `.env`, `.env.local`, service-account files, or local machine state.

## Editing Guidance

- Prefer changing source files, not generated output alone, unless the task is explicitly a direct hotfix.
- Keep docs aligned when automation behavior changes materially.
- Keep changes narrow and reversible.

## Verification

Before closing work, verify the minimum relevant outcome:

- script logic changed: run available checks if the runtime exists
- report logic changed: inspect the generated report paths
- telegram logic changed: verify daemon/helper references stay consistent

If local runtime tools are missing, state that clearly in the final handoff.

## Handoff Notes

- The repo is the source of truth for project state.
- Local secrets and local Codex scheduler state do not transfer automatically.
- When resuming on another machine, start from the handoff and report files listed above.
