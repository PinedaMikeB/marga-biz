# Location SEO Tracker

Updated: 2026-03-28

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

- Google snapshot refreshed live on 2026-03-28 using `SERPAPI_KEY`.
- Snapshot timestamp: 2026-03-28T01:50:13.295Z
- `printer rental makati`: rank 5 on Google snapshot, ranking URL: https://marga.biz/printer-rental/
- `printer rental bgc`: rank 3 on Google snapshot, ranking URL: https://marga.biz/printer-rental/
- `printer rental pasig`: rank Not in top 10 on Google snapshot, not ranking in top 10 yet
- `printer rental ortigas`: rank 4 on Google snapshot, ranking URL: https://marga.biz/contact/
- `printer rental quezon city`: rank 8 on Google snapshot, ranking URL: https://marga.biz/contact/
- `printer rental manila`: rank 5 on Google snapshot, ranking URL: https://marga.biz/

## Current Rank Notes

- `printer rental makati`: improved from rank 7 to rank 5, but Google is still choosing `/printer-rental/` instead of `/printer-rental/makati/`.
- `printer rental bgc`: held at rank 3, but Google is still ranking `/printer-rental/` instead of `/printer-rental/bgc/`.
- `printer rental pasig`: dropped from rank 7 to outside the top 10. The immediate response on 2026-03-28 was to strengthen `/printer-rental/pasig/` with clearer `printer leasing Pasig` and `printer for rent in Pasig` intent copy so Google has a stronger local target than the generic site pages.
- `printer rental ortigas`: slipped from rank 3 to rank 4 and Google is still ranking `/contact/` instead of `/printer-rental/ortigas/`.
- `printer rental quezon city`: improved from outside the top 10 to rank 8, but Google is still choosing `/contact/` instead of `/printer-rental/quezon-city/`.
- `printer rental manila`: held at rank 5, but the homepage still ranks instead of `/printer-rental/manila/`.

## Review Note 2026-03-25

- Finished this review cycle: ran the live Google SERP monitor and compared the fresh `2026-03-25T12:37:03.527Z` snapshot against the stored `2026-03-24T14:52:50.399Z` snapshot.
- Autonomous action completed: added a stronger contextual handoff inside `how-to-choose-printer-rental-pasig` pointing users and search intent more clearly to `/printer-rental/pasig/`.
- Verification completed: `npm run build` passed successfully after the content change.

## Review Note 2026-03-27

- Finished this review cycle: attempted a fresh live Google pull using the shared `SERPAPI_KEY`, but the request failed immediately with `fetch failed` in this sandbox, so this run compared the latest stored Google snapshot `2026-03-25T12:37:03.527Z` against the prior stored `2026-03-24T14:52:50.399Z` snapshot instead.
- Rank movement available this cycle stayed based on that stored comparison: `printer rental makati` dropped `5 -> 7`, `printer rental bgc` held at `3`, `printer rental pasig` improved from not in the top 10 to `7`, `printer rental ortigas` held at `3` but shifted from `/printer-rental/` to `/contact/`, `printer rental quezon city` stayed outside the top 10, and `printer rental manila` improved `6 -> 5`.
- Autonomous action completed: added one stronger Ortigas support-article handoff covering `printer leasing Ortigas`, `printer for rent`, and `Print All You Can` while pointing city-level intent back to `/printer-rental/ortigas/`.
- Verification completed: `PATH=/opt/homebrew/bin:$PATH npm run build` passed, and the generated `dist/printer-rental/best-printer-rental-setup-ortigas/index.html` contains the new Ortigas reinforcement copy.

## Review Note 2026-03-28

- Finished this review cycle: ran a fresh live Google SERP pull using the shared `SERPAPI_KEY` and compared the new `2026-03-28T01:50:13.295Z` snapshot against the stored `2026-03-25T12:37:03.527Z` snapshot.
- Rank movement this cycle: `printer rental makati` improved `7 -> 5`, `printer rental bgc` held at `3`, `printer rental pasig` dropped `7 -> outside the top 10`, `printer rental ortigas` slipped `3 -> 4`, `printer rental quezon city` improved from outside the top 10 to `8`, and `printer rental manila` held at `5`.
- Autonomous action completed: strengthened the Pasig money page with a tighter local-intent handoff covering `printer rental Pasig`, `printer leasing Pasig`, `printer for rent in Pasig`, and `Print All You Can` while explicitly positioning `/printer-rental/pasig/` as the main Pasig quote page.
- Verification completed: `PATH=/opt/homebrew/bin:$PATH npm run build` passed, and the generated `dist/printer-rental/pasig/index.html` contains the new Pasig intent copy.

## Next Focus

- `[ ]` correct Ortigas targeting so Google stops choosing `/contact/` for `printer rental ortigas`
- `[ ]` correct Pasig targeting so Google stops choosing `/contact/` for `printer rental pasig`
- `[ ]` strengthen the dedicated BGC money page so Google replaces `/printer-rental/` with `/printer-rental/bgc/`
- `[ ]` correct Makati targeting so Google replaces `/printer-rental/` with `/printer-rental/makati/`
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
