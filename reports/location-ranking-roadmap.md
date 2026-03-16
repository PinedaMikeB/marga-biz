# Location Ranking Roadmap

Updated: 2026-03-16

## Primary Goal

Move Google away from ranking the homepage for local printer queries and make these dedicated landing pages the intended ranking URLs:

- `https://marga.biz/printer-rental/makati/`
- `https://marga.biz/printer-rental/bgc/`

## Current Snapshot

- `printer rental makati`: homepage ranking, not the Makati page
- `printer rental bgc`: homepage ranking, not the BGC page
- `printer rental ortigas`: homepage ranking
- `printer rental manila`: homepage ranking

This means Google still sees the root domain as the strongest answer. The local pages now need stronger indexing, stronger internal relevance, and stronger off-site trust.

## 1. Ranking Target Pages

Use these pages as the money pages:

- `/printer-rental/makati/`
- `/printer-rental/bgc/`

Do not retarget the homepage for these terms.

## 1A. Recommended Site Model

Use a controlled 4-tier topic model, not 4 layers of URL depth everywhere.

Tier 1:

- parent hub: `/printer-rental/`

Tier 2:

- city money pages: `/printer-rental/makati/`, `/printer-rental/bgc/`, then Pasig, Ortigas, Quezon City, Manila

Tier 3:

- city support articles with distinct intent
- examples: buying guides, startup guides, office-fit guides, admin-team guides

Tier 4:

- proof and amplification assets
- examples: testimonials, case snippets, FAQs, slide-video content, social posts, YouTube uploads, citations

Important:

- keep the architecture shallow and understandable
- do not create deep nested URLs just to simulate authority
- authority comes from relevance, internal linking, proof, and distribution, not URL depth alone

## 2. Internal Link System

Already implemented in code:

- `Printer Rental` mother page now links to Makati and BGC with contextual language.
- Core printer pages link to Makati and BGC:
  - `printer-for-rent`
  - `laser-printer-rental`
  - `inkjet-printer-rental`
  - `print-all-you-can`
  - `best-printer-rental-company`
  - `office-printers-for-rent`
  - `laser-printers-for-rent`
  - `multifunction-printers-for-rent`
  - `cost-effective-printer-rentals-for-startups`

Next internal-link targets to add later if needed:

- `types-of-printers-for-rent/desktop-printers-for-rent/`
- `types-of-printers-for-rent/network-printers-for-rent/`
- `types-of-printers-for-rent/color-printers-for-rent/`

## 3. Search Console Actions

Manual actions required:

1. Open Google Search Console.
2. Inspect `https://marga.biz/printer-rental/makati/`.
3. Request indexing.
4. Inspect `https://marga.biz/printer-rental/bgc/`.
5. Request indexing.
6. Resubmit sitemap if needed: `https://marga.biz/sitemap.xml`.

Watch for:

- which URL Google chooses for `printer rental makati`
- which URL Google chooses for `printer rental bgc`
- crawl/index status
- impressions and clicks by page

## 4. Local Proof To Add Next

Collect and place on the location pages if true and available:

- Makati office testimonials
- BGC or Taguig office testimonials
- sample client types served in those districts
- real turnaround expectations
- real printer models commonly deployed in those areas
- building-access or office-fit details that show local experience

Do not add fake addresses or fake branch claims.

## 5. Supporting Content To Publish

Published:

- `/printer-rental/how-to-choose-printer-rental-makati/`
- `/printer-rental/best-printer-rental-setup-bgc/`

Next support pages to publish only if each page has unique intent and real value:

- `Printer Rental for Shared Offices in Bonifacio Global City`
- `What Makati Admin Teams Usually Need From a Rental Printer`

Each article should link to its matching money page.

## 5A. Next City Build Order

Next city pages to build after Makati and BGC:

1. `Pasig`
2. `Ortigas`
3. `Quezon City`
4. `Manila`

Recommended reason for this order:

- `Pasig` is currently not in the top 10 and has weak, beatable results.
- `Ortigas` is already showing the homepage in the top 10, so a dedicated page can replace it.
- `Quezon City` has demand but needs a clearer local target page.
- `Manila` already ranks, so it is slightly less urgent than the gaps above.

## 5B. Release Workflow

Working rule going forward:

1. Make one small verified change set.
2. Run the relevant local check, usually `npm run build`.
3. Commit immediately to `main`.
4. Push immediately to GitHub.
5. Confirm production deploy before starting the next major step.

Why:

- smaller pushes expose deployment or generation errors earlier
- easier rollback if something breaks
- easier to map ranking changes to specific edits

Guardrail:

- still avoid pushing broken or unverified work just to push faster

## 5C. Content Distribution

For each important city page and support article, create a simple slide-style video and distribute it across owned channels.

Primary distribution:

- YouTube
- Facebook page
- Instagram reels or carousel adaptation
- TikTok slide-style version if usable for the brand

Recommended content format:

- 5 to 10 slides only
- one keyword/theme per video
- simple office visuals, printer visuals, short text overlays, clear CTA
- link back to the exact target URL in the description and profile links

First video topics:

- `Printer Rental Makati`
- `How to Choose Printer Rental in Makati for Office Teams`
- `Printer Rental BGC`
- `Best Printer Rental Setup for BGC Offices and Startups`

Goal:

- support branded search
- create more entity and topical signals around each city page
- build reusable content for social, YouTube, and future embed opportunities

## 6. Off-Site Authority Work

Manual actions required:

- strengthen Facebook business content around Makati and BGC service coverage
- improve citation consistency across directories
- pursue real mentions from local partners, suppliers, clients, or local business listings
- make sure Google Business Profile categories, service descriptions, and service areas are accurate

Do not create fake staffed locations.

## 7. Weekly Monitoring Routine

Run:

```bash
npm run build
node scripts/serp-monitor.js --engines=google
```

Track each week:

- rank
- ranking URL
- new competitors in top 10
- title/snippet changes
- whether local pages begin replacing the homepage

Decision rule:

- If the homepage still ranks after 2 to 4 weeks, add more contextual links and more local proof.
- If the local page starts ranking but stalls at positions 4 to 8, improve title, opening copy, and off-site trust.
- If the page reaches positions 2 to 3, focus on CTR, testimonials, and a stronger snippet.

## GA4 / Lead Tracking

Already connected:

- GA4 measurement ID is active on the site.
- Location pages now send page context:
  - `page_type`
  - `service_area`
  - `service_category`
- CTA clicks on Makati and BGC pages now carry labels so quote/call intent can be segmented.

Recommended GA4 custom dimensions to register:

- `page_type`
- `service_area`
- `service_category`
- `ga_label`
- `ga_section`

Recommended reports:

- quote clicks by service area
- phone clicks by service area
- engagement and scroll depth on Makati vs BGC
- landing page sessions and conversions for local pages
