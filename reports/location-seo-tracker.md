# Location SEO Tracker

Updated: 2026-03-24

Use this file as the working checklist. When you ask what is finished or pending, this is the source of truth.

## Status Key

- `[x]` finished
- `[ ]` pending
- `[~]` in progress
- `[?]` needs approval

## Foundation

- `[x]` Create `Printer Rental Makati` money page
- `[x]` Create `Printer Rental BGC` money page
- `[x]` Add contextual links from strong printer pages to Makati and BGC
- `[x]` Add service-area section to `Printer Rental` mother page
- `[x]` Add SERP monitoring script and reports
- `[x]` Add local GA4 context and CTA labels
- `[x]` Add first support article for Makati
- `[x]` Add first support article for BGC
- `[x]` Push verified changes to `main`

## Current City Sequence

1. `Makati`
   - `[x]` money page
   - `[x]` first support article
   - `[?]` add Makati proof/testimonials if available
   - `[?]` submit page in Google Search Console
2. `BGC`
   - `[x]` money page
   - `[x]` first support article
   - `[?]` add BGC or Taguig proof/testimonials if available
   - `[?]` submit page in Google Search Console
3. `Pasig`
   - `[x]` money page
   - `[x]` first support article
   - `[x]` internal-link reinforcement
4. `Ortigas`
   - `[x]` money page
   - `[x]` first support article
   - `[x]` internal-link reinforcement
5. `Quezon City`
   - `[x]` money page
   - `[x]` first support article
   - `[x]` internal-link reinforcement
6. `Manila`
   - `[x]` money page
   - `[x]` first support article
   - `[x]` internal-link reinforcement

## Support Cluster Standards

- `[x]` each city must have a money page
- `[x]` each city must have at least one support article
- `[ ]` each city should get a second support article
- `[ ]` each city should get local proof content if true and available
- `[ ]` each city should get slide-video distribution assets

## Distribution

- `[ ]` `Printer Rental Makati` slide video
- `[ ]` `How to Choose Printer Rental in Makati for Office Teams` slide video
- `[ ]` `Printer Rental BGC` slide video
- `[ ]` `Best Printer Rental Setup for BGC Offices and Startups` slide video
- `[ ]` Facebook posting workflow for city pages
- `[ ]` YouTube description links pointing to exact landing pages

## Monitoring

- `[x]` SERP monitor setup
- `[x]` daily or morning review automation
- `[x]` weekly rank review note in tracker
- `[ ]` GA4 custom dimensions registered manually
- `[ ]` Search Console indexing and performance review

## Approval Queue

These items should be proposed before content or major code changes are pushed.

- `[?]` build second support article for Makati
- `[?]` build second support article for BGC
- `[?]` build second support article for Pasig
- `[?]` build second support article for Ortigas
- `[?]` build second support article for Quezon City
- `[?]` build second support article for Manila
- `[?]` create first 6 slide-video outlines

## Last Verified Snapshot

- Google snapshot refreshed live on 2026-03-24 using `SERPAPI_KEY`.
- Snapshot timestamp: 2026-03-24T14:52:50.399Z
- `printer rental makati`: rank 5 on Google snapshot, ranking URL: https://marga.biz/contact/
- `printer rental bgc`: rank 3 on Google snapshot, ranking URL: https://marga.biz/printer-rental/
- `printer rental pasig`: rank Not in top 10 on Google snapshot, not ranking in top 10 yet
- `printer rental ortigas`: rank 3 on Google snapshot, ranking URL: https://marga.biz/printer-rental/
- `printer rental quezon city`: rank Not in top 10 on Google snapshot, not ranking in top 10 yet
- `printer rental manila`: rank 6 on Google snapshot, ranking URL: https://marga.biz/

## Current Rank Notes

- `printer rental makati`: held at rank 5, but Google is now choosing `/contact/` instead of a printer-rental landing page. This is a URL-targeting problem, not a visibility win.
- `printer rental bgc`: improved from rank 10 to rank 3, but Google is ranking `/printer-rental/` instead of `/printer-rental/bgc/`.
- `printer rental pasig`: still not in the top 10. This remains the clearest gap among the city pages.
- `printer rental ortigas`: improved from rank 9 to rank 3, but Google is ranking `/printer-rental/` instead of `/printer-rental/ortigas/`.
- `printer rental quezon city`: still not in the top 10 with no verified breakthrough yet.
- `printer rental manila`: slipped from rank 5 to rank 6, and the homepage still ranks instead of `/printer-rental/manila/`.

## Review Note 2026-03-24

- Finished this review cycle: ran the live Google SERP monitor, compared the fresh snapshot against the stored 2026-03-16 snapshot, and updated this tracker with current rank notes.
- Autonomous action completed: added a stronger contextual handoff inside `best-printer-rental-setup-bgc` pointing users and search intent more clearly to `/printer-rental/bgc/`.
- Verification completed: `npm run build` passed successfully after the content change.

## Next Focus

- `[ ]` strengthen the dedicated BGC money page so Google replaces `/printer-rental/` with `/printer-rental/bgc/`
- `[ ]` strengthen the dedicated Ortigas money page so Google replaces `/printer-rental/` with `/printer-rental/ortigas/`
- `[ ]` correct Makati targeting so Google stops choosing `/contact/`
- `[ ]` build second support article for Pasig
- `[ ]` build second support article for Quezon City
- `[ ]` build second support article for Makati
- `[ ]` build second support article for BGC
- `[ ]` build second support article for Ortigas
- `[ ]` build second support article for Manila
- `[ ]` create slide-video outlines for the first 6 money pages

## Operating Rule

For this repo, prefer:

1. one small change set
2. verify locally
3. push to `main`
4. confirm deploy
5. update this tracker
