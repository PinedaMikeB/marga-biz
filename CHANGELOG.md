# CHANGELOG - MARGA.BIZ

All notable changes and deployments. Use this for rollbacks.

---

## Version Format
`vX.Y.Z` — Major.Minor.Patch  
Each entry includes rollback instructions.

---

## [v1.4.0] - 2026-01-12

### 🤖 AI SEO Analysis Feature (Phase 3.3)

**Summary:** Claude AI-powered SEO analysis with recommendations.

**Changes:**
- Claude API integration for SEO data analysis
- Traffic trend analysis (week-over-week comparison)
- Content gap detection for keyword opportunities
- Ranking change alerts
- AI recommendations with priority levels
- 12-hour Firebase caching to reduce API costs
- AI Insights section on Overview dashboard

**New Files:**
- `netlify/functions/insights-ai.js` - Claude API function
- `js/admin/insights/ai-insights-ui.js` - Frontend UI component

**Modified Files:**
- `admin/insights/index.html` - Added AI section
- `admin/insights/css/insights.css` - AI styling
- `js/admin/insights/insights-api.js` - AI endpoint
- `netlify/functions/package.json` - firebase-admin dependency

**Git Commit:** `99cac69`

**Rollback Instructions:**
```bash
# Option 1: Revert commit
git revert 99cac69

# Option 2: Checkout previous version
git checkout 5234628 -- admin/insights/ js/admin/insights/ netlify/functions/

# Option 3: Remove AI files only
rm netlify/functions/insights-ai.js
rm js/admin/insights/ai-insights-ui.js
git checkout 5234628 -- admin/insights/index.html admin/insights/css/insights.css js/admin/insights/insights-api.js
```

**Verification:**
- [ ] https://marga.biz/admin/insights/ loads AI section
- [ ] AI analysis generates recommendations
- [ ] Cache badge shows when using cached data

---

## [v1.3.0] - 2026-01-11

### 📊 INSIGHTS MODULE Complete (Phase 3.1 & 3.2)

**Summary:** Full analytics dashboard with Firebase historical storage.

**Changes:**
- Built all 5 dashboard tabs (Overview, Traffic, Behavior, SEO, Conversions)
- Firebase Firestore integration for historical data
- Daily snapshot function (runs 6 AM PHT automatically)
- Trend calculations (week-over-week comparisons)
- First snapshot captured successfully

**Dashboard URLs:**
- /admin/insights/ (Overview)
- /admin/insights/traffic.html
- /admin/insights/behavior.html
- /admin/insights/seo.html
- /admin/insights/conversions.html

**Netlify Functions Added:**
- insights-traffic.js
- insights-behavior.js
- insights-snapshot.js (scheduled)
- insights-history.js

**Git Commit:** `3efdd4f`

**Rollback Instructions:**
```bash
git revert 3efdd4f
# Or remove admin folder:
rm -rf admin/insights/
rm -rf js/admin/insights/
rm netlify/functions/insights-*.js
```

**Files Changed:**
- admin/insights/*.html (5 files)
- js/admin/insights/*.js (6 files)
- netlify/functions/insights-*.js (5 files)
- netlify.toml (scheduled function config)

**Verification:**
- [x] https://marga.biz/admin/insights/ loads with real data
- [x] All 5 tabs working
- [x] Firebase snapshot function runs successfully
- [x] Historical data retrievable via insights-history endpoint

---

## [v1.2.0] - 2026-01-10

### 📊 INSIGHTS MODULE - Overview Dashboard Live

**Summary:** Analytics dashboard with GA4 and Search Console integration.

**Changes:**
- Created /admin/insights/ dashboard
- Connected GA4 Data API (real data showing)
- Connected Search Console API
- Overview tab with KPIs, charts, top pages, keywords

**Git Commit:** `bd58728`

**Rollback Instructions:**
```bash
git checkout bd58728~1 -- admin/ js/admin/ netlify/functions/
```

**Verification:**
- [x] Real GA4 data displaying
- [x] Charts rendering correctly

---

## [v1.1.1] - 2026-01-10

### 🔗 Internal Link Click Tracking

**Summary:** Added tracking for internal navigation clicks.

**Changes:**
- Added `click_internal_link` event to ga4-events.js
- Tracks link text and destination URL

---

## [v1.0.0] - 2026-01-08

### 🚀 Initial Static Site Launch

**Summary:** WordPress to Netlify migration complete.

**Changes:**
- Migrated 896 pages + 1,007 blog posts (1,903 total)
- DNS switched from Hostinger WordPress to Netlify
- SSL certificate provisioned via Let's Encrypt
- GA4 tracking (G-L8XL675H9L) added to all pages
- SEO preserved (titles, meta descriptions, canonicals)

**Git Commit:** *(add commit hash after push)*

**Rollback Instructions:**
```bash
# If site is broken, restore WordPress hosting:
# See DNS-ROLLBACK.md for full instructions

# Quick DNS rollback at Hostinger:
# 1. Delete A record pointing to 75.2.60.5
# 2. Delete CNAME www → marga-biz.netlify.app
# 3. Re-add A record: @ → (Hostinger IP from DNS-ROLLBACK.md)
# 4. Wait 5-30 minutes for propagation
```

**Files Changed:**
- All files in `/dist/`
- `netlify.toml`
- `_redirects`
- `robots.txt`
- `sitemap.xml`

**Verification:**
- [x] https://marga.biz loads with SSL
- [x] www redirects to non-www
- [x] GA4 receiving data
- [x] Email still working (MX records intact)

---

## [v1.1.0] - 2026-01-10

### 📊 GA4 Custom Event Tracking Added

**Summary:** Added comprehensive event tracking for user behavior analytics.

**Changes:**
- Created `/js/ga4-events.js` — Custom event tracking script
- Injected tracking script into all 1,904 HTML pages
- Created `add-ga4-events.js` — Injection utility script

**Events Now Tracked:**
| Event | Description |
|-------|-------------|
| `click_quote_button` | "Get Instant Quote" and CTA button clicks |
| `click_phone` | Phone number clicks (tel: links) |
| `click_email` | Email link clicks (mailto:) |
| `click_pricing_guide` | Pricing guide button clicks |
| `scroll_depth` | 25%, 50%, 75%, 100% scroll milestones |
| `click_cta` | All other CTA button clicks |
| `outbound_click` | External link clicks |
| `form_submit` | Form submissions |
| `page_engagement` | Time on page tracking |

**Git Commit:** *(add commit hash after push)*

**Rollback Instructions:**
```bash
# Remove ga4-events.js script tag from all files
cd "/Volumes/Wotg Drive Mike/GitHub/marga-biz"
find dist -name "*.html" -exec sed -i '' 's|<script src="/js/ga4-events.js" defer></script>||g' {} \;
rm dist/js/ga4-events.js
rm js/ga4-events.js
git add .
git commit -m "Rollback: Remove GA4 custom events"
git push origin main
```

**Files Changed:**
- `js/ga4-events.js` (new)
- `dist/js/ga4-events.js` (new)
- `add-ga4-events.js` (new)
- All 1,904 HTML files in `/dist/`

**Verification:**
- [ ] https://marga.biz loads without JS errors
- [ ] Open browser DevTools Console, see "GA4 Events: All tracking initialized"
- [ ] Click "Get Instant Quote" → see `click_quote_button` event in console
- [ ] Click phone number → see `click_phone` event in console
- [ ] GA4 Realtime → Events shows new custom events within 24-48 hours

---

## [v1.0.1] - 2026-01-10

### 📄 Documentation System Added

**Summary:** Created 3-file documentation system for session continuity.

**Changes:**
- Added `MASTERPLAN.md` — Architecture & task tracking
- Added `CHANGELOG.md` — Version history & rollbacks
- Updated `HANDOFF.md` — Live session state

**Git Commit:** *(add commit hash after push)*

**Rollback Instructions:**
```bash
# These are documentation files only, no rollback needed
# If needed, restore from git:
git checkout HEAD~1 -- MASTERPLAN.md CHANGELOG.md HANDOFF.md
```

**Files Changed:**
- `MASTERPLAN.md` (new)
- `CHANGELOG.md` (new)
- `HANDOFF.md` (updated)

---

## Template for New Entries

```markdown
## [vX.Y.Z] - YYYY-MM-DD

### 📦 Short Title

**Summary:** One-line description.

**Changes:**
- Change 1
- Change 2

**Git Commit:** `abc1234`

**Rollback Instructions:**
\`\`\`bash
git revert abc1234
# or
git checkout HEAD~1 -- path/to/file
\`\`\`

**Files Changed:**
- file1
- file2

**Verification:**
- [ ] Check 1
- [ ] Check 2
```

---

## Rollback Quick Reference

### Full Site Rollback (Git)
```bash
cd "/Volumes/Wotg Drive Mike/GitHub/marga-biz"

# See recent commits
git log --oneline -10

# Rollback to specific commit
git checkout <commit-hash> -- dist/

# Push rollback
git add .
git commit -m "Rollback to v1.0.0"
git push origin main
```

### DNS Rollback (WordPress)
See `DNS-ROLLBACK.md` for full instructions.

### Single File Rollback
```bash
# Restore single file from previous commit
git checkout HEAD~1 -- path/to/file.html

# Or from specific commit
git checkout abc1234 -- path/to/file.html
```

---

*Update this file after every deployment.*
