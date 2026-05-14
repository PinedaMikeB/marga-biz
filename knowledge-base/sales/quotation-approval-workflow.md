# Quotation Approval Workflow

The Talk to Sales flow should work like this:

1. Prospect opens `/ai-consultant/` from Talk to Sales.
2. Prospect fills name, mobile, email, company, service, and need.
3. AI Product Consultant asks qualifying questions before recommending any plan.
4. The transcript is saved to the website inquiry.
5. A draft quotation is prepared from the lead, transcript, restricted pricing guide, and Mike sales style.
6. The draft is emailed to Mike for approval.
7. Only after Mike approves should the system send the quotation email to the prospect.
8. The prospect email should BCC Mike.

Do not send unapproved quotations to prospects.

Recommended Netlify environment variables:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` or `EMAIL_FROM`
- `QUOTE_APPROVAL_EMAIL` or `SALES_EMAIL`
- `QUOTE_BCC_EMAIL`
- `SITE_URL`

If SMTP is not configured, save the draft on the inquiry record and keep the lead status pending manual review.
