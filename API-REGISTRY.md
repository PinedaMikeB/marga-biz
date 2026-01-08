# 🎯 MARGA PLATFORM - API REGISTRY

**Master List of All APIs and Modules**

Last Updated: 2026-01-08
Status: Planning Phase

---

## 📊 API Architecture Overview

```
Unified Database: Firebase (sah-spiritual-journal)
API Layer: Cloud Functions
Authentication: Firebase Auth
Access: Public (website) + Private (app)
```

---

## ✅ ANSWERS TO YOUR QUESTIONS

### Q1: Will API/module strategy work?
**YES! ✅** This is industry best practice (microservices architecture)

**Benefits:**
- Easy troubleshooting (isolate modules)
- Reusable across all apps
- Scalable (add without breaking)
- Testable independently

### Q2: Need masterlist of modules and functions?
**ABSOLUTELY! ✅** This document IS that masterlist. 

**Update it every time you:**
- Add new endpoint
- Modify existing API
- Add new module
- Change data structure

### Q3: Can APIs be used by future apps outside Marga?
**YES! 100%! ✅** Same API works for:
- Website
- Mobile app (future)
- Partner integrations (future)
- Third-party tools
- Admin dashboards

**Example:**
```javascript
// Website uses it
POST https://api.marga.biz/inquiries/create

// Future mobile app uses SAME API
POST https://api.marga.biz/inquiries/create

// Future CRM uses SAME API  
POST https://api.marga.biz/inquiries/create
```

---

## 🗂️ MODULE REGISTRY

### Module 1: Website Public API

**Purpose:** Handle public website interactions
**Location:** `functions/modules/website/`
**Status:** 🔄 In Development

#### Endpoints:

| Endpoint | Method | Auth | Purpose | Input | Output |
|----------|--------|------|---------|-------|--------|
| `/api/inquiries/create` | POST | None | Submit inquiry form | name, email, phone, message | inquiryId, success |
| `/api/inquiries/list` | GET | Staff | List all inquiries | limit, status | inquiries[] |
| `/api/contact/send` | POST | None | Send contact email | email, subject, message | success, messageId |
| `/api/quote/request` | POST | None | Request quotation | customerData, requirements | quoteId, success |

**Collections Used:**
- `inquiries/` (write)
- `events/` (write)

**Triggers:**
- Creates event: `NEW_INQUIRY`
- Sends to: Marketing module

**Example Usage:**
```javascript
// Website inquiry form
const response = await fetch('https://api.marga.biz/inquiries/create', {
  method: 'POST',
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '09171234567',
    message: 'Need copier rental quote'
  })
});
```

---

### Module 2: Marketing Automation

**Purpose:** Lead management, follow-ups, campaigns
**Location:** `functions/modules/marketing/`
**Status:** 📋 Planned

#### Endpoints:

| Endpoint | Method | Auth | Purpose | Input | Output |
|----------|--------|------|---------|-------|--------|
| `/api/leads/create` | POST | Staff | Create new lead | leadData | leadId |
| `/api/leads/get` | GET | Staff | Get lead details | leadId | lead |
| `/api/leads/update` | PUT | Staff | Update lead | leadId, updates | success |
| `/api/leads/convert` | POST | Staff | Convert to customer | leadId | customerId |
| `/api/campaigns/send` | POST | Staff | Send email campaign | template, recipients | campaignId |
| `/api/followups/schedule` | POST | Staff | Schedule follow-up | leadId, date, type | followupId |

**Collections Used:**
- `leads/` (read, write)
- `campaigns/` (write)
- `followups/` (write)
- `events/` (write)

**Triggers:**
- Listens: `NEW_INQUIRY`
- Creates: `LEAD_QUALIFIED`, `CAMPAIGN_SENT`

---

### Module 3: AI Chat Widget

**Purpose:** Automated customer support
**Location:** `functions/modules/chat/`
**Status:** 📋 Planned

#### Endpoints:

| Endpoint | Method | Auth | Purpose | Input | Output |
|----------|--------|------|---------|-------|--------|
| `/api/chat/start` | POST | None | Start chat session | visitorId | sessionId |
| `/api/chat/message` | POST | None | Send message | sessionId, message | aiResponse |
| `/api/chat/history` | GET | Staff | Get chat history | sessionId | messages[] |
| `/api/chat/handoff` | POST | Staff | Transfer to human | sessionId, staffId | success |

**Collections Used:**
- `chat-sessions/` (read, write)
- `chat-messages/` (write)
- `inquiries/` (write - if qualified)

**External APIs:**
- OpenAI GPT-4

**Triggers:**
- Creates: `CHAT_QUALIFIED_LEAD`

---

### Module 4: SEO Monitoring

**Purpose:** Track rankings, analyze performance
**Location:** `functions/modules/seo/`
**Status:** 📋 Planned

#### Endpoints:

| Endpoint | Method | Auth | Purpose | Input | Output |
|----------|--------|------|---------|-------|--------|
| `/api/seo/check-ranking` | POST | Cron | Check keyword rankings | keywords[] | rankings[] |
| `/api/seo/get-rankings` | GET | Staff | Get current rankings | date | rankings[] |
| `/api/seo/analyze-page` | POST | Staff | Analyze page SEO | url | analysis |
| `/api/seo/competitors` | GET | Staff | Compare competitors | keyword | comparison |

**Collections Used:**
- `seo-rankings/` (write)
- `seo-analysis/` (write)

**External APIs:**
- Google Search Console API
- Ahrefs/Semrush API (optional)

**Schedule:**
- Daily: 2 AM Manila time

---

### Module 5: Analytics & Tracking

**Purpose:** Visitor behavior, conversion tracking
**Location:** `functions/modules/analytics/`
**Status:** 📋 Planned

#### Endpoints:

| Endpoint | Method | Auth | Purpose | Input | Output |
|----------|--------|------|---------|-------|--------|
| `/api/analytics/track` | POST | None | Track event | event, data | success |
| `/api/analytics/pageview` | POST | None | Track pageview | page, visitor | success |
| `/api/analytics/heatmap` | GET | Staff | Get heatmap data | page, dateRange | heatmapData |
| `/api/analytics/conversions` | GET | Staff | Get conversion data | dateRange | conversions[] |

**Collections Used:**
- `visitor-tracking/` (write)
- `page-views/` (write)
- `conversions/` (write)

---

### Module 6: Customer Portal (Future)

**Purpose:** Customer self-service
**Location:** `functions/modules/portal/`
**Status:** 🔮 Future

#### Endpoints:

| Endpoint | Method | Auth | Purpose | Input | Output |
|----------|--------|------|---------|-------|--------|
| `/api/portal/login` | POST | Customer | Customer login | email, password | token |
| `/api/portal/dashboard` | GET | Customer | Get dashboard data | customerId | dashboardData |
| `/api/portal/invoices` | GET | Customer | List invoices | customerId | invoices[] |
| `/api/portal/request-service` | POST | Customer | Request service | customerId, issue | ticketId |

**Collections Used:**
- `customers/` (read)
- `invoices/` (read)
- `service-requests/` (write)

---

### Module 7: Marga App Integration (Future)

**Purpose:** Connect with existing Marga App
**Location:** `functions/modules/app-integration/`
**Status:** 🔮 Future

#### Endpoints:

| Endpoint | Method | Auth | Purpose | Input | Output |
|----------|--------|------|---------|-------|--------|
| `/api/app/customer-create` | POST | Staff | Create customer in app | customerData | customerId |
| `/api/app/customer-get` | GET | Staff | Get customer from app | customerId | customerData |
| `/api/app/machines-list` | GET | Staff | List customer machines | customerId | machines[] |
| `/api/app/billing-sync` | POST | Cron | Sync billing data | - | syncResult |

**Collections Used:**
- `app/customers/` (read, write)
- `app/machines/` (read)
- `app/billing/` (read)

---

## 🔄 Event System (Module Communication)

Modules communicate via events in Firestore:

| Event | Triggered By | Listened By | Purpose |
|-------|--------------|-------------|---------|
| `NEW_INQUIRY` | Website | Marketing | New lead from website |
| `LEAD_QUALIFIED` | Marketing | Sales | Lead ready for sales |
| `CHAT_QUALIFIED_LEAD` | Chat | Marketing | Lead from chat |
| `CUSTOMER_CONVERTED` | Marketing | App | New customer created |
| `CUSTOMER_TERMINATED` | App | Marketing | Re-engagement campaign |
| `CAMPAIGN_SENT` | Marketing | Analytics | Track campaign |

**How it works:**
```javascript
// Module A creates event
await firestore.collection('events').add({
  type: 'NEW_INQUIRY',
  data: { inquiryId: '123' },
  timestamp: FieldValue.serverTimestamp()
});

// Module B listens for event
firestore.collection('events')
  .where('type', '==', 'NEW_INQUIRY')
  .onSnapshot((snapshot) => {
    snapshot.docs.forEach(doc => {
      // Process inquiry
    });
  });
```

---

## 🔐 Authentication Levels

| Level | Access | Use Case |
|-------|--------|----------|
| **None** | Public | Website forms, chat |
| **Customer** | Customer portal | View own data |
| **Staff** | Dashboard | Manage leads, customers |
| **Admin** | Full access | All operations |
| **Cron** | Scheduled tasks | Automated jobs |

---

## 📊 Data Flow Example

**Scenario: Website Visitor → Customer**

```
1. Visitor submits inquiry form
   ↓
   Website Module: POST /api/inquiries/create
   ↓
   Creates: inquiries/abc123
   Creates: events/NEW_INQUIRY
   
2. Marketing module triggered (listens to events)
   ↓
   Reads: events/NEW_INQUIRY
   ↓
   Creates: leads/lead456
   Assigns: staff member
   Sends: welcome email
   
3. Staff qualifies lead
   ↓
   Marketing Module: POST /api/leads/convert
   ↓
   Creates: customers/cust789
   Creates: events/CUSTOMER_CONVERTED
   
4. App module triggered
   ↓
   Reads: events/CUSTOMER_CONVERTED
   ↓
   Syncs to: app/customers/
   Ready for: billing, machines
```

**All through APIs! Each module is independent!**

---

## 🎯 Troubleshooting Benefits

### Old Way (Monolithic):
```
Problem: Inquiry form broken
Steps: 
  1. Check entire website code
  2. Check database
  3. Check email system
  4. Check logging
Time: 2 hours
Scope: Entire system affected
```

### New Way (Modular API):
```
Problem: Inquiry form broken
Steps:
  1. Test API: curl POST /api/inquiries/create
  2. Works? → Fix website form
  3. Fails? → Fix API module only
Time: 5 minutes
Scope: Only that module affected
```

---

## 🎨 API Response Format

**Standard Success Response:**
```json
{
  "success": true,
  "data": {
    "inquiryId": "abc123",
    "status": "created"
  },
  "message": "Inquiry created successfully",
  "timestamp": "2026-01-08T00:00:00Z"
}
```

**Standard Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Email is required",
    "field": "email"
  },
  "timestamp": "2026-01-08T00:00:00Z"
}
```

---

## ✅ Benefits Summary

| Benefit | Impact |
|---------|--------|
| **Reusable** | Same API for website, app, future tools |
| **Scalable** | Add modules without breaking existing |
| **Testable** | Test each module independently |
| **Maintainable** | Fix bugs in isolation |
| **Documented** | This registry = single source of truth |
| **Team-Ready** | Multiple devs work on different modules |
| **Future-Proof** | Easy to add new features |

---

## 📋 Module Dependencies

```
Website → inquiries, events
Marketing → leads, campaigns, events, inquiries (read)
Chat → chat-sessions, inquiries, events
SEO → seo-rankings
Analytics → visitor-tracking, conversions
App Integration → app/*, customers, events
```

---

## 🚀 Development Workflow

### Adding New API Endpoint:

1. **Update this registry** with endpoint details
2. **Create function** in appropriate module folder
3. **Write tests** for the endpoint
4. **Deploy** to Firebase
5. **Update client** (website/app) to use it
6. **Document** any changes here

### When Troubleshooting:

1. **Check this registry** - which module handles this?
2. **Test API directly** - does endpoint work?
3. **Check events** - are triggers firing?
4. **Check logs** - any errors in Firebase Console?
5. **Fix module** - isolated from other modules

---

## 🔮 Future Modules (Ideas)

- **Email Templates Module** - Manage email templates
- **SMS Module** - Send SMS notifications
- **Payment Module** - Process payments online
- **Reports Module** - Generate business reports
- **AI Assistant Module** - AI-powered recommendations
- **Mobile App API** - Dedicated mobile endpoints
- **Integrations Module** - Third-party integrations (Zapier, etc.)

---

## 📈 Next Steps

1. ✅ Create template system (generate 896 pages)
2. 🔄 Build Website Module APIs (inquiries, contact)
3. 📋 Build Marketing Module
4. 📋 Build Chat Module
5. 📋 Build SEO Module
6. 🔮 Future modules as needed

---

## 📝 Update Log

| Date | Change | By |
|------|--------|-----|
| 2026-01-08 | Initial creation | Mike |
| | | |
| | | |

---

**⚠️ IMPORTANT: Update this registry every time you add/modify an API!**

**This document is your single source of truth for all modules and APIs.**
