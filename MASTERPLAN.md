# MARGA.BIZ MASTERPLAN

**Project:** Marga Enterprises Website & Business Platform  
**Owner:** Mike Pineda  
**Last Updated:** June 12, 2026

---

## 🎯 VISION

Transform marga.biz from a static marketing site into a full business platform with content management, SEO automation, and lead/sales tracking — all while maintaining the #2 Google ranking for "printer rental philippines."

---

## 🏗️ ARCHITECTURE

### 6-Module System

```
marga.biz/
├── 1. WEBSITE MODULE (Public-Facing)      ✅ COMPLETE
│   └── Static HTML/JS served via Netlify CDN
│
├── 2. ADMIN MODULE (Content Management)   🔲 TODO
│   ├── Firebase Authentication
│   ├── Blog post editor (CRUD)
│   ├── Page editor
│   └── Image management
│
├── 3. INSIGHTS MODULE (Analytics + SEO)   🔲 TODO ← NEW!
│   ├── Traffic Dashboard (GA4 Data API)
│   ├── Visitor Behavior (clicks, scroll, engagement)
│   ├── SEO Performance (Search Console API)
│   ├── Indexing Status (indexed vs not)
│   └── Conversion Tracking (leads, calls, quotes)
│
├── 4. SEO MODULE (Automation)             🔲 TODO
│   ├── Claude API content generation
│   ├── Meta description optimizer
│   ├── Backlink monitoring
│   └── Social media auto-posting
│
├── 5. SALES MODULE (Leads & CRM)          🔲 TODO
│   ├── Lead capture forms
│   ├── Quotation system
│   ├── Lead nurturing workflows
│   └── Email/SMS automation
│
└── 6. HR MODULE (Employees + Payroll)     🔲 TODO
    ├── Employee master records
    ├── Work location pins and GPS time-in
    ├── Attendance and payroll computation
    └── Performance analytics from app evaluations
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Hosting | Netlify (free tier) |
| CDN | Netlify Edge (global) |
| DNS | Hostinger |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Functions | Netlify Functions |
| Analytics | GA4 (G-L8XL675H9L) |
| AI | Claude API |
| Version Control | GitHub |

### API Structure (Planned)

```
/api/website/   → Public content endpoints
/api/admin/     → Content management (auth required)
/api/insights/  → Analytics & SEO data (auth required) ← NEW!
/api/seo/       → SEO automation (auth required)
/api/sales/     → Lead management (auth required)
```

---

## 📁 KEY FILE LOCATIONS

| Item | Path |
|------|------|
| Live Site | https://marga.biz |
| Netlify Dashboard | https://app.netlify.com/projects/marga-biz |
| GitHub Repo | https://github.com/PinedaMikeB/marga-biz |
| Local Repo | `/Volumes/Wotg Drive Mike/GitHub/marga-biz/` |
| Production Files | `/dist/` |
| WordPress Data | `/data/wordpress-data.json` |
| Netlify Config | `/netlify.toml` |
| Redirects | `/_redirects` |

---

## ✅ TASK CHECKLIST

### Legend
- `[x]` Complete
- `[~]` In Progress  
- `[ ]` Not Started

### Phase 1: Migration (COMPLETE)
- [x] Export WordPress content to JSON
- [x] Generate static HTML pages (1,903 total)
- [x] Preserve SEO (titles, meta, canonicals)
- [x] Deploy to Netlify
- [x] Configure DNS (A, CNAME, MX records)
- [x] Fix SSL certificate (removed AAAA record)
- [x] Add GA4 tracking to all pages
- [x] Verify site loads with HTTPS
- [x] Create DNS rollback documentation

### Phase 2: Event Tracking & Redirects
- [x] Add custom GA4 events for button clicks
- [x] Track "Get Instant Quote" clicks
- [x] Track phone number clicks (tel: links)
- [x] Track form submissions
- [x] Track scroll depth on key pages
- [ ] Audit 404 errors in Google Search Console
- [ ] Add missing 301 redirects to `_redirects`
- [ ] Submit updated sitemap to Google

### Phase 3: Insights Module (Analytics + SEO Dashboard)
- [x] Set up Google Cloud Project for API access
- [x] Enable GA4 Data API
- [x] Enable Search Console API
- [x] Create service account & credentials
- [x] Build Netlify Functions for data fetching
- [x] Create admin/insights/ dashboard pages
- [x] Overview tab with KPIs (visitors, pageviews, clicks, indexed)
- [x] Traffic Over Time chart
- [x] Top Pages list
- [x] Traffic Sources pie chart
- [x] Top Keywords list
- [x] Date range selector (7d, 30d, 90d)

#### Phase 3.1: Build Remaining Dashboard Tabs (~30 min each)
- [x] Traffic tab - detailed traffic analysis, sources breakdown, devices
- [x] Behavior tab - click events, scroll depth, engagement time
- [x] SEO tab - indexing status, keyword rankings, position changes
- [x] Conversions tab - quote clicks, phone calls, form submissions funnel

#### Phase 3.2: Firebase Historical Data Storage (~20 min)
- [x] Create Firebase collection for daily snapshots
- [x] Build Netlify scheduled function (daily cron)
- [x] Store daily KPIs: visitors, pageviews, clicks, rankings
- [x] Enable week-over-week and month-over-month comparisons
- [x] Grant Firebase access to Google service account (IAM Editor role)
- [x] Test snapshot function - first data captured successfully

#### Phase 3.3: AI SEO Analysis Feature (~1 hour) - NEXT SESSION
- [ ] Claude API integration for insights analysis
- [ ] Traffic trend analysis ("Traffic up/down X%")
- [ ] Content gap detection ("Create page for keyword X")
- [ ] Page performance recommendations
- [ ] Ranking change alerts
- [ ] Store AI insights in Firebase
- [ ] Display AI recommendations in dashboard
- [ ] Add "AI Insights" section to Overview tab

### Phase 4: Admin Module
- [ ] Set up Firebase project (or use existing)
- [ ] Create admin authentication (login page)
- [ ] Build blog post list view
- [ ] Build blog post editor (create/edit/delete)
- [ ] Build page editor
- [ ] Image upload to Firebase Storage
- [ ] Auto-regenerate static files on publish

### Phase 5: SEO Module
- [ ] Claude API integration
- [ ] Blog post generator (AI-assisted)
- [ ] Meta description optimizer
- [ ] Backlink monitor
- [ ] Social media auto-post on publish

#### Phase 5.1: Active SEO Monitoring Clusters
- [x] Monitor core printer rental cluster: `/printer-rental/`, `/printer-rental/printer-for-rent/`, `/printer-rental/print-all-you-can/`, `/printer-rental/philippines/`, and supported printer city pages.
- [x] Add owned-printer maintenance / managed print services cluster as a monitored SEO area.
- [x] Publish maintenance cluster pages:
  - `/printer-maintenance/`
  - `/printer-maintenance/owned-printer-maintenance/`
  - `/printer-maintenance/printer-rental-vs-maintenance/`
  - `/printer-maintenance/page-monitoring/`
  - `/managed-print-services/`
  - `/print-management-system/`
- [ ] Track Search Console impressions, clicks, CTR, average position, ranking URL correctness, and cannibalization for the maintenance cluster.
- [ ] Track target queries: printer maintenance, printer repair, office printer maintenance, owned printer maintenance, managed print services, print management system, print manager, manage print system, monthly page monitoring, and print volume tracking.
- [ ] Keep the cluster focused on B2B owned-printer cost control for companies that ended rental and bought their own machine.

### Phase 6: Sales Module
- [x] Lead capture form integration
- [x] Route fast quote CTAs to the existing AI Product Consultant flow
- [ ] Lead list & management
- [ ] Quotation builder
- [ ] Email/SMS follow-up automation
- [ ] Lead scoring system

### Phase 7: HR Module
- [x] Add first HR settings screen for official work location pins
- [x] Enforce GPS tolerance caps: Office / Production max 30 meters; Customer Site max 100 meters
- [ ] Add employee master records with editable salary, SSS, PHIC, HDMF, loans, cash advances, allowances, and payroll fields
- [ ] Add mobile/web time-in flow with GPS, pincode, assigned work-location validation, and exception review
- [ ] Add payroll engine based on the April 2026 payroll workbook formulas
- [ ] Add performance tab using attendance and app evaluation analytics

---

## 📝 DECISION LOG

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-12 | Auto-push site changes to `main` after every agent edit | Mike validates on production immediately; Netlify deploys from `main` / `dist` |
| 2026-06-12 | AIStaff product page under `/services/aistaff/` with animated hero demo | Shows full Messenger → quote → pay → dashboard → ROI story without touching protected homepage/copier SEO |
| 2026-05-14 | Add HR as the sixth platform module with strict GPS-gated attendance | Payroll should be computed from approved employee records and verified app time records instead of manual spreadsheet-only inputs |
| 2026-05-14 | Cap office and production time-in GPS tolerance at 30 meters; cap customer sites at 100 meters | Prevent broad location spoofing while allowing normal phone GPS drift at real work locations |
| 2026-05-14 | Use `Talk to Sales` as the public CTA while routing to the AI Product Consultant | Keeps the CTA human and conversion-focused while the consultant introduces herself after the click |
| 2026-04-20 | Add owned-printer maintenance / managed print services as a monitored SEO cluster | Capture companies cutting cost after ending printer rental while keeping printer-rental pages focused on machine-included packages |
| 2026-01-10 | Create INSIGHTS MODULE combining Analytics + SEO | Single dashboard for all data, avoid switching between GA4 and Search Console |
| 2026-01-10 | Expand to 5-module architecture | Better separation of concerns: Insights (view data) vs SEO (automation) vs Sales (leads) |
| 2026-01-08 | Migrate from WordPress to static | Faster load times, lower cost, maintain SEO |
| 2026-01-08 | Use Netlify over Vercel | Free tier sufficient, simpler setup |
| 2026-01-08 | Keep DNS at Hostinger | Email MX records already configured there |
| 2026-01-08 | Delete AAAA record | Was blocking Netlify SSL provisioning |
| 2026-01-10 | Create 3-file documentation system | Prevent context loss between sessions |

---

## 🔧 DEVELOPMENT NOTES

### Documentation Workflow (IMPORTANT)

**During every coding session, Claude must:**

1. **Update HANDOFF.md** — Log current work, blockers, and session notes
2. **Update MASTERPLAN.md** — Mark completed tasks `[x]`, add new tasks, log decisions
3. **Update CHANGELOG.md** — After each deployment, add version entry with:
   - Summary of changes
   - Git commit hash
   - Rollback instructions
   - Files changed

**Starting a new session:**
> Say: "Read HANDOFF.md, MASTERPLAN.md, and CHANGELOG.md from `/Volumes/Wotg Drive Mike/GitHub/marga-biz/` using Desktop Commander"

### Deployment Workflow

**Mike rule (2026-06-12): push every site change to `main` immediately** so live testing at `https://marga.biz/` is always current. Do not leave site work local-only waiting for a manual deploy.

1. Make changes locally in `/Volumes/Wotg Drive Mike/GitHub/marga-biz/`
2. Sync `static-pages/` → `dist/` when the published path is static HTML
3. Commit only files for that task (avoid unrelated zip/report bundles)
4. **Push to GitHub `main` branch** — required after every site-visible change
5. Netlify auto-deploys within 1–2 minutes (`publish = dist` in `netlify.toml`)
6. **Update CHANGELOG.md** when the change is user-facing (optional for small copy tweaks)

### Two Folders (Don't Confuse)
- `marga-biz/` = Production website (deployed)
- `Marga-website/` = Migration toolkit (not deployed)

### Important Scripts
- `add-ga4.js` — Injects GA4 tracking into HTML files
- `scripts/` — Various build/utility scripts

---

*This file is the source of truth for project planning. Update after every session.*
