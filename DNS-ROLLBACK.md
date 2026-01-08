# DNS Rollback Instructions for marga.biz
## Created: January 8, 2026

---

## CURRENT SETUP (Netlify - Active)

| Type | Name | Value |
|------|------|-------|
| ALIAS | @ | `apex-loadbalancer.netlify.com` |
| CNAME | www | `marga-biz.netlify.app` |

---

## ROLLBACK TO WORDPRESS (If needed)

If something goes wrong with Netlify, change these records in Hostinger:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| **A** | @ | `185.187.241.42` | 14400 |
| **CNAME** | www | `marga.biz` | 14400 |

### Steps to rollback:
1. Login to Hostinger: https://hpanel.hostinger.com/domain/marga.biz/dns
2. Find the ALIAS record for @ → Click Edit → Change to A record → Enter `185.187.241.42`
3. Find the CNAME record for www → Click Edit → Change value to `marga.biz`
4. Wait 5-30 minutes for DNS propagation
5. Test https://marga.biz - should show WordPress site

---

## RECORDS TO NEVER TOUCH (Email & Other Services)

These must stay unchanged for email and subdomains to work:

### Email Records (Hostinger Email)
| Type | Name | Value |
|------|------|-------|
| MX | @ | mx1.hostinger.ph (priority 5) |
| MX | @ | mx2.hostinger.ph (priority 10) |
| TXT | @ | v=spf1 include:_spf.mail.hostinger.com ~all |
| TXT | _dmarc | v=DMARC1; p=none |
| CNAME | autodiscover | autodiscover.mail.hostinger.com |
| CNAME | autoconfig | autoconfig.mail.hostinger.com |

### Google Verification
| Type | Name | Value |
|------|------|-------|
| TXT | @ | google-site-verification=bNGG2J8wbWlHaHTdiBSOhp6MQoQJsuBNgKD7SELRrhs |

### Other Subdomains (Keep these!)
| Type | Name | Value | Purpose |
|------|------|-------|---------|
| A | accountingtest | 147.93.44.119 | Accounting test |
| A | browser | 62.72.26.131 | Browser app |
| A | ftp | 185.187.241.42 | FTP access |
| ALIAS | app | app.marga.biz.cdn.hstgr.net | App subdomain |
| A | automation | 62.72.26.131 | Automation |
| A | accountingsystem | 62.72.26.131 | Accounting system |
| A | accounting | 82.112.231.54 | Accounting |

---

## USEFUL LINKS

- **Hostinger DNS Panel:** https://hpanel.hostinger.com/domain/marga.biz/dns
- **Netlify Dashboard:** https://app.netlify.com/projects/marga-biz
- **Netlify Site:** https://marga-biz.netlify.app
- **Live Site:** https://marga.biz

---

## DNS PROPAGATION CHECK

After making changes, check propagation at:
- https://dnschecker.org/#A/marga.biz
- https://www.whatsmydns.net/#A/marga.biz

---

## CONTACT

If you need help, this setup was configured on January 8, 2026.
Original WordPress IP: 185.187.241.42 (Hostinger)
