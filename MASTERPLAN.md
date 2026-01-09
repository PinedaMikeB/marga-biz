# MARGA.BIZ MASTERPLAN

**Project:** Marga Enterprises Website & Business Platform  
**Owner:** Mike Pineda  
**Last Updated:** January 10, 2026  

---

## 🎯 VISION

Transform marga.biz from a static marketing site into a full business platform with content management, SEO automation, and lead/sales tracking — all while maintaining the #2 Google ranking for "printer rental philippines."

---

## 🏗️ ARCHITECTURE

### 4-Module System

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
├── 3. SEO MODULE (Automation)             🔲 TODO
│   ├── Claude API content generation
│   ├── Rank tracking
│   ├── Backlink monitoring
│   └── Social media auto-posting
│
└── 4. SALES MODULE (Leads & CRM)          🔲 TODO
    ├── GA4 custom event tracking
    ├── Visitor behavior analysis
    ├── Lead capture forms
    ├── Quotation system
    └── Lead nurturing workflows
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
- [ ] Add custom GA4 events for button clicks
- [ ] Track "Get Instant Quote" clicks
- [ ] Track phone number clicks (tel: links)
- [ ] Track form submissions
- [ ] Track scroll depth on key pages
- [ ] Audit 404 errors in Google Search Console
- [ ] Add missing 301 redirects to `_redirects`
- [ ] Submit updated sitemap to Google

### Phase 3: Admin Module
- [ ] Set up Firebase project (or use existing)
- [ ] Create admin authentication (login page)
- [ ] Build blog post list view
- [ ] Build blog post editor (create/edit/delete)
- [ ] Build page editor
- [ ] Image upload to Firebase Storage
- [ ] Auto-regenerate static files on publish

### Phase 4: SEO Module
- [ ] Claude API integration
- [ ] Blog post generator (AI-assisted)
- [ ] Meta description optimizer
- [ ] Rank tracking dashboard
- [ ] Backlink monitor
- [ ] Social media auto-post on publish

### Phase 5: Sales Module
- [ ] Lead capture form integration
- [ ] Visitor tracking dashboard
- [ ] Lead list & management
- [ ] Quotation builder
- [ ] Email/SMS follow-up automation
- [ ] Lead scoring system

---

## 📝 DECISION LOG

| Date | Decision | Rationale |
|------|----------|-----------|
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
1. Make changes locally in `/Volumes/Wotg Drive Mike/GitHub/marga-biz/`
2. Test locally if needed
3. Commit and push to GitHub `main` branch
4. Netlify auto-deploys within 1-2 minutes
5. **Update CHANGELOG.md with new version entry**

### Two Folders (Don't Confuse)
- `marga-biz/` = Production website (deployed)
- `Marga-website/` = Migration toolkit (not deployed)

### Important Scripts
- `add-ga4.js` — Injects GA4 tracking into HTML files
- `scripts/` — Various build/utility scripts

---

*This file is the source of truth for project planning. Update after every session.*
