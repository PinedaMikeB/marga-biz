# HANDOFF - MARGA.BIZ

**Last Updated:** January 12, 2026  
**Current Version:** v2.1.0 (MCP-Style Agent System)  
**Site Status:** ✅ LIVE & HEALTHY

---

## 🔗 QUICK LINKS

| Resource | URL |
|----------|-----|
| Live Site | https://marga.biz |
| Insights Dashboard | https://marga.biz/admin/insights/ |
| Settings + Scanner | https://marga.biz/admin/insights/settings.html |

---

## 🤖 AGENT ARCHITECTURE (MCP-Style)

### How It Works Now

The Manager uses **tools directly** (MCP-style) for immediate results:

```
User: "Check my ranking for printer rental philippines"
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                    MANAGER AGENT                        │
│                                                         │
│  1. Sees ranking request                                │
│  2. Calls checkRanking() tool DIRECTLY                  │
│  3. Gets LIVE SERP data                                 │
│  4. Analyzes and responds with REAL data                │
└─────────────────────────────────────────────────────────┘
```

### Available Tools (lib/agent-tools.js)

| Tool | Function | Data Source |
|------|----------|-------------|
| `scan_page` | Scan page for SEO | page-scanner function |
| `check_ranking` | Live SERP position | Serper.dev API |
| `find_competitors` | Who ranks above you | Serper.dev API |
| `get_search_console` | Historical rankings | Firebase snapshots |
| `get_site_overview` | Site stats | Firebase marga_site |

---

## 🔑 API KEYS NEEDED

### Serper.dev (for live SERP)
- **Status:** Not configured
- **Get key:** https://serper.dev (FREE 2,500/month)
- **Add to Netlify:** Environment variable `SERPER_API_KEY`

---

## 📁 Key Files

```
netlify/functions/
├── agent-manager.js      # Orchestrator with tools
├── agent-search.js       # Search Agent (SERP checking)
├── agent-dashboard.js    # Dashboard API
├── lib/
│   ├── agent-utils.js    # Firebase helpers
│   └── agent-tools.js    # MCP-style tools
├── page-scanner.js       # Deep page analysis
├── site-scanner.js       # Sitemap scanning
└── insights-*.js         # Analytics functions
```

---

## 🔧 Firebase Collections

| Collection | Purpose |
|------------|---------|
| `marga_agents` | Agent statuses |
| `marga_tasks` | Task queue (legacy) |
| `marga_pages` | Scanned page data |
| `marga_site` | Site structure |
| `marga_rankings` | Ranking history |
| `insights_snapshots` | Daily analytics |

---

## ✅ What's Working

1. **Manager Agent** - Uses tools directly, gives real analysis
2. **Page Scanner** - Scans pages, returns SEO data
3. **Search Agent** - Ready (needs API key for live SERP)
4. **Site Scanner** - Scans sitemap, stores key pages
5. **Chat Widget** - User interface for Manager

---

## ⏳ Not Built Yet

- **Tracker Agent** - Issue tracking, follow-ups
- **Content Agent** - Content generation
- **AI Search Agent** - Perplexity/ChatGPT monitoring
- **Bing Submission** - Submit URLs to Bing

---

## 📋 Recent Commits

```
41287cd Fix: Remove duplicate code block in agent-tools.js
798be98 Fix: Remove leftover code causing syntax error
a3125f0 Major: Manager now uses tools directly (MCP-style)
655ad80 Phase 2: Search Agent - Live SERP rankings
```

---

## 🔄 ROLLBACK

To revert to pre-agent system:
```bash
git revert 41287cd 798be98 a3125f0 655ad80
```
