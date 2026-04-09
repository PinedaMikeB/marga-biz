# Marketing Automation

This workspace is the home for the `marketing-automation` pipeline inside `marga-biz`.

## Team Structure

- `orchestrator`: receives a campaign brief, calls workers in order, validates outputs, and handles approval gates
- `research-agent`: finds topics, competitors, and relevant customer pain points
- `campaign-planner`: turns research into a focused campaign plan and content brief
- `creative-agent`: produces creative specs and asset requests
- `copy-agent`: writes channel-specific captions, titles, descriptions, and CTAs
- `distribution-agent`: prepares publish manifests, scheduling payloads, and platform delivery
- `performance-analyst`: reviews results, spots opportunities, and recommends the next actions

## Current Scope

The workspace now includes a runnable orchestrated pipeline.

Current workers:

- `research-agent`
- `campaign-planner`
- `creative-agent`
- `copy-agent`
- `distribution-agent`
- `performance-analyst`

The orchestrator reads:

- `automations/marketing-automation/data/campaign-brief.sample.json`
- `reports/serp-monitor/latest.json`
- `reports/facebook/latest.json`
- optional manual platform metrics in `automations/marketing-automation/data/manual-metrics.sample.json`

It writes:

- `automations/marketing-automation/reports/orchestrator/latest.md`
- `automations/marketing-automation/reports/orchestrator/latest.json`
- `automations/marketing-automation/reports/<worker>/latest.*`
- `automations/marketing-automation/runs/<run-id>/...`

## Run

Full pipeline:

```bash
node "automations/marketing-automation/orchestrator.js"
```

Full pipeline with a specific brief:

```bash
node "automations/marketing-automation/orchestrator.js" \
  --brief="automations/marketing-automation/data/campaign-brief.sample.json"
```

Standalone performance analyst:

```bash
node "automations/marketing-automation/workers/performance-analyst.js"
```

## Why The Analyst Matters

The rest of the automation can create and distribute content, but the performance analyst is the feedback loop.

It answers:

- Which keywords are closest to page-one wins?
- Which locations are invisible and need coverage?
- Which recent content topic was distributed?
- Which channel metrics suggest double-down, fix, or stop?
- What should the next campaign focus on?

## Current Guardrails

- Facebook is aligned to the repo's existing publisher flow.
- Instagram, Threads, and YouTube are generated as planning artifacts only for now.
- The orchestrator writes real briefs, copy, manifests, and analysis without pretending unsupported live APIs already exist in this repo.
