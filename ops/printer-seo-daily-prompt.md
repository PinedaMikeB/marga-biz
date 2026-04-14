Use [$autonomous-automation](/Users/mike/.codex/skills/autonomous-automation/SKILL.md).

Run the printer SEO monitor for `marga.biz` and follow the repo `AGENTS.md` SEO execution policy.

Strategic goal:
- make `Printer Rental`, `Printer For Rent`, and `Print All You Can` reach `#1`
- make local terms like `Printer Rental BGC`, `Printer Rental Makati`, `Printer Rental Manila`, `Printer Rental Philippines`, and `Printer Rental Taguig` reach the top results
- verify the live ranking for `Copier Rental` and `Copier For Rent` on every run so we do not assume they still hold
- monitor `Copier Rental` and `Copier For Rent` as protected winners without editing the home page or copier core pages
- expand copier growth through location intent such as `Copier Rental BGC`, `Copier Rental Makati`, `Copier Rental Manila`, `Copier Rental Taguig`, `Copier Rental Quezon City`, `Copier Rental Pasig`, and `Copier Rental Ortigas`
- keep expanding the printer-rental cluster with useful local coverage where supported

Daily production rules:
- create exactly `2` new pages across printer or copier-local pillar/support opportunities when real gaps justify them
- publish exactly `5` supporting blogs that strengthen commercial intent, local relevance, and internal linking across the printer and copier-location clusters
- treat all other task categories as variable, based on:
  1. the current distance from the ranking goal
  2. daily competitor research, strengths, weaknesses, and content/trust gaps worth matching or improving on

Non-stop optimization loop:
- research printer and copier-location competitors every day
- identify the highest-value ranking gaps every day
- turn those gaps into implementation work the same day
- if new high-value tasks are uncovered, add them instead of stopping at a fixed checklist
- treat copier core winners as monitor-only, but actively create or improve copier location pages, copier support pages, copier location subpages, and copier internal links when the data supports it

Complete the full daily printer SEO batch before turning anything over:
- improve the scheduled printer-rental pages
- improve or create copier location growth pages and support assets when they are part of the batch
- create copier-location child/support pages and blog content under the location clusters when the gaps justify them
- publish the required support pages and blogs when they are part of the batch
- add internal links
- fix on-page SEO issues
- refresh FAQ and schema blocks
- improve conversion sections
- close competitor gaps

Hard constraints:
- do not touch the home page
- do not touch copier-rental money pages
- focus edits on the printer-rental cluster plus copier location growth pages only
- do not stop at recommendations or partial implementation
- do not assume yesterday's ranking data is still true; re-check live rankings before setting the day's priorities

Before editing any content:
1. self-heal the runtime from inside the current automation root
2. fast-forward to the latest `origin/main` when the repo is clean
3. run `npm run automation:preflight -- --sync-main --strict`
4. if you encounter a stale task, stale lock, stale in-progress run, or stale queue item, determine whether it is genuinely active or stale, repair it if safe, and continue the same run

If preflight fails:
- diagnose and repair the git/runtime/env/network problem first
- rerun preflight
- do not touch SEO pages until preflight passes

If a stale task or stale run state is discovered:
- inspect the lock, pid, timestamps, heartbeat, and latest report state before assuming another run is truly active
- when this prompt is running under `scripts/run-printer-seo-daily.js`, the lock owner is expected to be the Codex process parent. If `PRINTER_SEO_CHILD_RUN=1`, `PRINTER_SEO_LOCK_OWNER_PID` matches the first line of `PRINTER_SEO_LOCK_PATH`, and that PID is the parent or ancestor of the current Codex process, treat the lock as this run's own wrapper lock and continue instead of self-blocking.
- if it is stale, clear or repair it in the most durable safe way and continue the same run
- if it is still active, avoid duplicate work and move to the next safe step or the next scheduled run
- if it cannot be repaired safely, email a short stale-task blocker summary, write the same blocker into `reports/seo-monitor/latest.md` and `reports/seo-monitor/latest.json`, and then continue with any remaining safe work instead of stopping at the first stale failure

Turnover requirements:
1. local verification
2. commit only relevant files
3. push to GitHub
4. deploy to production with `npm run deploy`
5. verify the live URLs
6. update `reports/seo-monitor/latest.md` and `reports/seo-monitor/latest.json`
7. email the report with `node scripts/send-email-report.js`
8. send the same summary to Telegram
9. mark items `Done` only after the live URLs are real

Use `Blocked` only for a real external blocker after serious repair attempts.

Prefer durable fixes over one-off workarounds whenever you find an automation failure.
