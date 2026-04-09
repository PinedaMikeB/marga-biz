# Distribution Agent Report

Generated: 2026-04-02T05:07:23.899Z

## Publish Manifest

- facebook: supported-in-repo | Use the existing Facebook publisher after approving copy and destination.
- instagram: planning-only | Prepare caption and asset package; live publishing is not wired in this repo yet.
- threads: planning-only | Prepare the short post and hold for future API wiring or manual posting.
- youtube: planning-only | Prepare the title, description, and storyboard; hold until upload automation is added.

## Repo Commands

- node scripts/facebook-page-publisher.js preview --page=static-pages/printer-rental/index.html
- node scripts/facebook-page-publisher.js publish --page=static-pages/printer-rental/index.html

## Approval Checklist

- Confirm the landing page is the right destination for this campaign.
- Review all platform copy for accuracy and tone.
- Keep Instagram, Threads, and YouTube in plan-only mode until their APIs are added in this repo.

The distribution agent converts campaign outputs into a publish manifest that matches current repo reality. Facebook can move through the existing publisher flow, while Instagram, Threads, and YouTube stay in planning mode so we do not pretend unsupported live automation already exists.
