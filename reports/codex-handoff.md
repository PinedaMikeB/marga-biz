# Codex Handoff

Updated: 2026-06-17

## What Transfers Cleanly

- Git repo state from `main`
- site code and generated `dist`
- initial HR settings UI and GPS validation helpers
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

## Deploy / Live Testing (Mike preference)

- After every **site-visible** change (HTML/CSS/JS in `static-pages/`, `dist/`, `components/`, `admin/`, `automations/seo-monitor/`, `_redirects`, etc.), agents must **commit and push to `main` before reporting done** so Mike can test in production/incognito immediately.
- Do not say a site-visible change is done while it only exists locally. If Mike asks for a visible change, the default finish line is: source update, generated `dist` update, relevant verification, narrow commit, `git push origin main`.
- Netlify auto-deploys from `main`; publish root is `dist/`. If source lives under `static-pages/`, copy the matching built file into `dist/` before push.
- Prefer `git push origin main` over manual `npm run deploy` unless functions or Netlify config need a CLI deploy.
- Keep commits narrow: do not bundle unrelated Facebook, Telegram, HR, SEO report, or function zip changes into a site push.
- Mike tests live at `https://marga.biz/` — hard refresh if the browser shows stale nav or hero content.

## Current Workflow

- Telegram bridge and chat daemon remain active in this repo.
- SEO automation and email automation were removed from the repo on 2026-03-31.
- A printer SEO monitor and a local email report helper can be reintroduced selectively when explicitly configured on the Mac that runs Codex.
- Do not expect older morning SEO review or email-monitor artifacts to keep updating unless those systems are reintroduced.

## SEO Monitoring Scope

- Core monitored SEO cluster: printer rental, printer for rent, Print All You Can, Printer Rental Philippines, and supported printer city pages.
- New monitored SEO cluster added on 2026-04-20: owned-printer maintenance / managed print services for companies that terminated rental, bought their own printer, and now need lower-cost service support.
- Monitor these new pages when the SEO monitor is active:
  - `/printer-maintenance/`
  - `/printer-maintenance/owned-printer-maintenance/`
  - `/printer-maintenance/printer-rental-vs-maintenance/`
  - `/printer-maintenance/page-monitoring/`
  - `/managed-print-services/`
  - `/print-management-system/`
- Target intent for the new cluster: `printer maintenance`, `printer repair`, `office printer maintenance`, `owned printer maintenance`, `managed print services`, `print management system`, `print manager`, `manage print system`, `monthly page monitoring`, and `print volume tracking`.
- Guardrail: keep this cluster B2B and owned-machine focused. It should support companies cutting cost after printer rental, not replace or weaken the main printer-rental pages.

## Recent Shipped (2026-06-12)

- **AIStaff landing** (`/services/aistaff/`): animated hero phone reel (Inquiry → Quote → Paid → Dashboard → ROI), SecureView CCTV example, infinite loop, mobile-friendly step labels.
- **Services nav**: dropdown after Printer Rental with AIStaff link (site-wide header).

## Current Next Focus

- continue HR module buildout: employee master records, attendance time-in flow, payroll engine, and performance tab
- wire HR location pins into the real Marga app repository/source once that source is confirmed
- keep Telegram chat tooling stable while other automation is reintroduced selectively
- when SEO monitoring is active, track both the printer-rental cluster and the new printer maintenance / managed print services cluster
- sales CTA flow now routes the visible `Talk to Sales` buttons into the existing `/ai-consultant/` voice consultant while keeping `Get Quote by Email` anchored to `/contact/#email-quote`

## Notes

- if the other Mac runs the always-on daemon, it can become the main Telegram bridge host
- the repo is the source of truth for project state
- the chat thread is not the source of truth; use the repo files above
