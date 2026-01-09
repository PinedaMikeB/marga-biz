# CHANGELOG - MARGA.BIZ

All notable changes and deployments. Use this for rollbacks.

---

## Version Format
`vX.Y.Z` — Major.Minor.Patch  
Each entry includes rollback instructions.

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
