# AGENTS.md

Repo-specific instructions for Codex and automation working inside `marga-biz`.

## Purpose

- Use this file as the repo-level operating guide before making changes.
- Prefer this file for project rules that are not obvious from code alone.
- Global system and developer instructions still take precedence over this file.

## Current Automation Scope

- Telegram chat tooling remains active in this repo.
- SEO automation and email automation were intentionally removed from this repo on 2026-03-31.
- A printer SEO monitor and email report helper may be reintroduced selectively when the user explicitly asks for them.
- If the printer SEO monitor is active, include the owned-printer maintenance / managed print services cluster added on 2026-04-20 in monitoring, alongside the printer-rental cluster.
- Do not assume older SEO daemons, SERP monitors, or email-monitor daemons still exist unless current repo files show they were reintroduced.

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

## Email Delivery

- Use repo helpers before inventing ad hoc email steps.
- The current report email helper is `scripts/send-email-report.js`.
- Use SMTP-only delivery from local automation env. Do not fall back to Apple Mail for automation email sends on this Mac.
- Do not commit local mail credentials, SMTP credentials, or Apple Mail state.

## Sales / AI Product Consultant

- For Talk to Sales / AI Product Consultant work, use `knowledge-base/sales/` and `netlify/functions/lib/sales-knowledge.js` as the sales knowledge source.
- The consultant must qualify before offering: ask why the prospect wants a quotation, whether they have an existing rental or purchased unit, current brand/model, monthly volume, office location, user count, color/A3/scan/copy needs, timeline, and pain with the current setup or provider.
- Follow Mike's consultative style: validate real frustration, explain Marga's managed-care app only after understanding the pain, and recommend only when rental benefits the customer.
- If usage is very low, warn that rental may be expensive and buying a small printer may be better.
- For copy-center prospects, ask whether copying is side income for an existing store or the main reason for renting a space; warn them to study volume carefully before committing to rental.
- Quotation emails to prospects require Mike approval first. Drafts may be generated from the pricing guide and transcript, but do not send an official quotation to the prospect until the approval workflow marks it approved.

## Local Env / Deploy

- Automation worktrees may not have the repo-local `.env.local` file available directly.
- Shared local automation env can be loaded from `~/.codex/env/marga-biz.env` or `~/.codex/env/marga-biz.local.env`.
- The production deploy helper is `scripts/deploy-site.js`; prefer `npm run deploy` over raw Netlify CLI calls.
- The durable automation root for scheduled runs is the internal clone at `~/.codex/repos/marga-biz-automation`, not the external-drive repo path.
- Scheduled automation runs should sync to the latest `origin/main` and pass `npm run automation:preflight -- --sync-main --strict` before making content edits.
- If Codex app-scheduled automations keep failing on sandboxed git/network access, prefer the local Codex CLI runner plus `launchd` from the internal automation clone instead of retrying the same restricted runtime.
- If a scheduled automation finds a stale task, stale lock, stale in-progress run, or stale queue item, it must first analyze whether that state is real or stale, attempt a durable repair, and continue the same run when repair succeeds.
- If the stale state cannot be repaired safely, the automation should email a short summary of the stale-task blocker, record it in the current report, mark only that item `Blocked`, and then continue with the rest of the run or yield to the next scheduled run instead of stopping the entire automation loop.

## Git Rules

- Commit only files relevant to the task you are pushing.
- Avoid bundling unrelated Facebook, Telegram, site, or other work into one commit.
- If the remote moved ahead, rebase cleanly and preserve unrelated local work.
- Do not commit secrets from `.env`, `.env.local`, service-account files, or local machine state.

## Editing Guidance

- Prefer changing source files, not generated output alone, unless the task is explicitly a direct hotfix.
- Keep docs aligned when automation behavior changes materially.
- Keep changes narrow and reversible.

## SEO Guardrails

- Treat the home page (`/`) and the Copier Rental page/cluster as protected when doing SEO work unless the user explicitly asks to change them.
- For SEO tasks in this repo, the current priority keyword/theme is `printer rental`.
- Secondary SEO monitoring cluster added on 2026-04-20: owned-printer maintenance and managed print services for companies that ended rental, bought their own printer, and now need lower-cost support. Monitor `/printer-maintenance/`, `/printer-maintenance/owned-printer-maintenance/`, `/printer-maintenance/printer-rental-vs-maintenance/`, `/printer-maintenance/page-monitoring/`, `/managed-print-services/`, and `/print-management-system/`.
- Keep the maintenance / managed-print cluster clearly B2B and cost-control focused. Do not let it cannibalize core `printer rental` intent; use it for owned-machine maintenance, printer repair, page monitoring, toner planning, managed print services, and print management system queries.
- When the user explicitly reintroduces printer SEO automation, treat the goal of winning the core printer-rental terms as the strategy, not just completing a static checklist. Fixed output targets like new pages or blogs can stay explicit, but the rest of the daily work should expand or contract based on ranking gaps and competitor findings.
- Focus improvements on the printer-rental cluster, supporting internal links, conversion paths, and crawlable service pages.
- Do not create doorway pages, spun location pages, keyword stuffing, or low-value filler content.
- Follow Google people-first content principles and preserve the existing brand/design language unless a UX or SEO improvement is clearly justified.
- Before changing printer-rental pages, audit current titles, meta descriptions, headings, canonicals, schema, internal links, and conversion elements in the repo.
- When adding or improving printer-rental pages, keep copy clear for business buyers in the Philippines and include only supportable claims.

## Verification

Before closing work, verify the minimum relevant outcome:

- script logic changed: run available checks if the runtime exists
- report logic changed: inspect the generated report paths
- telegram logic changed: verify daemon/helper references stay consistent
- automation runtime changed: verify the preflight from the automation-visible runtime, not only from the interactive shell

If local runtime tools are missing, state that clearly in the final handoff.

## Handoff Notes

- The repo is the source of truth for project state.
- Local secrets and local Codex scheduler state do not transfer automatically.
- When resuming on another machine, start from the handoff and report files listed above.
