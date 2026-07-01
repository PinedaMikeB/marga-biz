# Firebase Runtime Audit - 2026-07-01

This audit groups remaining Firebase dependencies in `marga-biz` so the cutover can happen in narrow, reversible passes.

## Group 1: Static page source media URLs

These are site-visible HTML sources that still hardcode Firebase-hosted media and should move first to local `/website-media/...` paths:

- `static-pages/**`

These are low-risk because they are static HTML and do not change page copy or layout when only asset URLs are rewritten.

## Group 2: Browser Firebase client

These files still initialize browser-side Firebase services:

- `js/firebase-config.js`

This should be removed or replaced only after confirming which browser features still require Firestore / Functions / Storage.

## Group 3: Netlify/admin/server functions on Firebase

These functions still use `firebase-admin` and need a collection-by-collection migration plan:

- `netlify/functions/website-inquiries.js`
- `netlify/functions/page-scanner.js`
- `netlify/functions/site-scanner.js`
- `netlify/functions/seo-monitor-report.js`
- `netlify/functions/seo-monitor-actions.js`
- `netlify/functions/insights-chat.js`
- `netlify/functions/insights-ai.js`
- `netlify/functions/insights-snapshot.js`
- `netlify/functions/insights-history.js`
- `netlify/functions/chat-sessions.js`
- `netlify/functions/config-manager.js`
- `netlify/functions/create-inquiry.js`
- `netlify/functions/quote-draft.js`
- `netlify/functions/quote-approval.js`
- `netlify/functions/ai-consultant-session.js`
- `netlify/functions/lib/agent-utils.js`
- `netlify/functions/lib/agent-tools.js`
- `netlify/functions/website-inquiries.js`

Initial recommendation:

- Migrate `website_inquiries` first because it is a business record flow.
- Migrate scanner / insights / agent collections second because they are internal tooling data.
- Remove unused Netlify/Firebase SEO monitor functions last if the local owner-controlled runtime replaces them.

## Group 4: Legacy Firebase-only utilities

These are migration helpers, upload tools, or old utilities that should not stay on the production path:

- `scripts/upload-images.js`
- `scripts/sync-images.js`
- `scripts/start-firebase-website-storage-download.sh`
- `scripts/restore-firebase-website-storage-backup.sh`
- `scripts/check-firebase-website-storage-download.sh`
- `firebase/functions/**`

These can remain temporarily as rescue tools until local storage and Postgres are fully proven, then be archived or removed.

## Cutover order

1. Rewrite static page media URLs away from Firebase.
2. Keep generated output visually identical and verify with local build.
3. Design Postgres tables / compatibility path for `website_inquiries`.
4. Migrate internal scanner / insights / agent collections.
5. Retire browser Firebase config only after no browser feature depends on it.
6. Block stale Firebase write paths after local read/write proof.
