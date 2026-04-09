# Facebook Page Automation

This repo can now prepare and publish Facebook Page posts from curated `static-pages/` landing pages.

## What It Does

- Limits the source content to curated `static-pages/` marketing pages
- Picks the next unpublished page by default
- Builds a caption from the page title, meta description, canonical URL, and location intent
- Stores publish state in `temp/facebook-page-publisher-state.json`
- Writes the latest preview or publish payload to `reports/facebook/latest.md`

## Required Environment Variables

Add these to `.env.local` before live publishing:

```bash
FACEBOOK_PAGE_ID=your_page_id
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
FACEBOOK_GRAPH_VERSION=v25.0
```

`FACEBOOK_GRAPH_VERSION` is optional and defaults to `v25.0`.

## Commands

```bash
npm run facebook:list
npm run facebook:preview
npm run facebook:publish
```

You can also target a specific page:

```bash
node scripts/facebook-page-publisher.js preview --page=static-pages/printer-rental/pasig/index.html
node scripts/facebook-page-publisher.js publish --page=static-pages/printer-rental/pasig/index.html
```

To mark a page as already posted manually:

```bash
node scripts/facebook-page-publisher.js mark-posted --page=static-pages/printer-rental/pasig/index.html --post-id=manual-2026-03-28
```

To schedule a post through the Graph API instead of publishing immediately:

```bash
node scripts/facebook-page-publisher.js publish --page=static-pages/printer-rental/pasig/index.html --schedule-at=2026-03-29T09:00:00+08:00
```

## Suggested Workflow

1. Run `npm run facebook:preview`
2. Review `reports/facebook/latest.md`
3. Run `npm run facebook:publish` once the Page token is configured

## Official References

- Meta Pages API overview: [developers.facebook.com/docs/pages-api/overview](https://developers.facebook.com/docs/pages-api/overview/)
- Meta Pages API getting started guide: [developers.facebook.com/docs/pages-api/getting-started](https://developers.facebook.com/docs/pages-api/getting-started/)
- Meta Page posts guide: [developers.facebook.com/docs/pages-api/posts](https://developers.facebook.com/docs/pages-api/posts/)
