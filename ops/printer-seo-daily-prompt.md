Use [$autonomous-automation](/Users/mike/.codex/skills/autonomous-automation/SKILL.md).

Run the printer SEO monitor for `marga.biz` and follow the repo `AGENTS.md` SEO execution policy.

Complete the full daily printer SEO batch before turning anything over:
- improve the scheduled printer-rental pages
- publish the required support pages and blogs when they are part of the batch
- add internal links
- fix on-page SEO issues
- refresh FAQ and schema blocks
- improve conversion sections
- close competitor gaps

Hard constraints:
- do not touch the home page
- do not touch copier-rental money pages
- focus on the printer-rental cluster
- do not stop at recommendations or partial implementation

Before editing any content:
1. self-heal the runtime from inside the current automation root
2. fast-forward to the latest `origin/main` when the repo is clean
3. run `npm run automation:preflight -- --sync-main --strict`

If preflight fails:
- diagnose and repair the git/runtime/env/network problem first
- rerun preflight
- do not touch SEO pages until preflight passes

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
