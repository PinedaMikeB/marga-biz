# AI Search Progress Dashboard

Track the merged AI SEO / GEO master plan: checkboxes, implement steps, links, and keyword analytics.

## URL

- Production: https://marga.biz/admin/ai-search-progress/
- Local: `npm run serve` then http://localhost:8080/admin/ai-search-progress/

## Features

- **Progress checklist** — checkbox per task; overall progress bar updates automatically
- **Implement** — steps and repo paths for each task
- **Details** — live page links, reports, videos; save custom links (YouTube, Remotion export, blog draft)
- **Menu → Keyword analytics** — Search Console positions via `insights-search` when on Netlify; editable notes and manual rank overrides (saved in browser localStorage)
- **Export** — download progress JSON
- **Reset checks** — clear checkboxes only (keeps notes and custom links)

## Edit the plan

Update `data/plan.json` (tasks, keywords, guardrails). Re-run `npm run generate` or copy `admin/` to `dist/` before deploy.

## Copier guardrail

Tasks and keywords marked `monitorOnly` / copier cluster remind you not to edit #1 copier pages.
