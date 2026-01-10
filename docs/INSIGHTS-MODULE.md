# INSIGHTS MODULE SPECIFICATION

**Module:** Insights (Analytics + SEO Dashboard)  
**Status:** 🔲 Planning  
**Priority:** High  
**Created:** January 10, 2026  

---

## 🎯 PURPOSE

Provide a unified dashboard to view all website analytics and SEO performance without needing to visit Google Analytics or Search Console directly.

---

## 📊 DATA SOURCES

| Source | API | What It Provides |
|--------|-----|------------------|
| Google Analytics 4 | GA4 Data API | Traffic, events, behavior, conversions |
| Google Search Console | Search Console API | Indexing, rankings, keywords, CTR |
| Internal (Firebase) | Firestore | Custom tracking, user preferences |

---

## 🏗️ ARCHITECTURE

### File Structure

```
marga-biz/
├── admin/
│   └── insights/
│       ├── index.html              # Dashboard home (overview)
│       ├── traffic.html            # Traffic deep-dive
│       ├── behavior.html           # Click & engagement analysis
│       ├── seo.html                # SEO & indexing status
│       ├── conversions.html        # Lead & conversion tracking
│       └── css/
│           └── insights.css        # Dashboard styles
│
├── js/
│   └── admin/
│       └── insights/
│           ├── insights-api.js     # API calls to Netlify Functions
│           ├── insights-charts.js  # Chart.js visualizations
│           ├── insights-ui.js      # Dashboard UI/interactions
│           └── insights-auth.js    # Firebase auth check
│
└── netlify/
    └── functions/
        ├── insights-ga4.js         # Fetch GA4 data
        ├── insights-search.js      # Fetch Search Console data
        └── insights-combined.js    # Combined dashboard data
```


### API Endpoints

```
GET /.netlify/functions/insights-ga4
    ?metrics=sessions,pageviews,events
    &dateRange=7d|30d|90d|custom
    &startDate=2026-01-01
    &endDate=2026-01-10

GET /.netlify/functions/insights-search
    ?type=performance|indexing|sitemaps
    &dateRange=7d|30d|90d

GET /.netlify/functions/insights-combined
    ?widgets=traffic,behavior,seo,conversions
    &dateRange=7d
```

---

## 📱 DASHBOARD WIDGETS

### 1. Traffic Overview (index.html)

| Metric | Source | Display |
|--------|--------|---------|
| Total Visitors | GA4 | Big number + trend |
| Page Views | GA4 | Big number + trend |
| Avg. Session Duration | GA4 | Time format |
| Bounce Rate | GA4 | Percentage |
| Traffic Sources | GA4 | Pie chart |
| Top Pages | GA4 | Table (top 10) |
| Visitors Over Time | GA4 | Line chart |

### 2. Behavior Analysis (behavior.html)

| Metric | Source | Display |
|--------|--------|---------|
| Quote Button Clicks | GA4 Events | Count + trend |
| Phone Clicks | GA4 Events | Count + trend |
| Email Clicks | GA4 Events | Count + trend |
| Internal Link Clicks | GA4 Events | Table by link_type |
| Scroll Depth Distribution | GA4 Events | Bar chart |
| Avg. Time on Page | GA4 | By page table |
| Click Heatmap (Top Pages) | GA4 Events | Visual |


### 3. SEO Performance (seo.html)

| Metric | Source | Display |
|--------|--------|---------|
| Total Indexed Pages | Search Console | Big number |
| Not Indexed Pages | Search Console | Big number (alert if high) |
| Indexing Issues | Search Console | Table with reasons |
| Top Keywords | Search Console | Table (position, clicks, CTR) |
| Avg. Position | Search Console | Number + trend |
| Total Impressions | Search Console | Number + trend |
| Total Clicks | Search Console | Number + trend |
| CTR | Search Console | Percentage + trend |
| Position Distribution | Search Console | Bar chart |

### 4. Conversions (conversions.html)

| Metric | Source | Display |
|--------|--------|---------|
| Quote Requests | GA4 Events | Count + funnel |
| Phone Call Clicks | GA4 Events | Count + trend |
| Form Submissions | GA4 Events | Count + trend |
| Conversion Rate | Calculated | Percentage |
| Top Converting Pages | GA4 | Table |
| Conversion Funnel | GA4 | Visual funnel |

---

## 🔐 AUTHENTICATION

- Uses Firebase Authentication (shared with Admin Module)
- Only authenticated users can access /admin/insights/
- Role-based access: `admin`, `viewer`

```javascript
// insights-auth.js
import { getAuth, onAuthStateChanged } from 'firebase/auth';

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = '/admin/login.html';
    }
});
```


---

## 🔑 API SETUP REQUIREMENTS

### Google Cloud Console Setup

1. **Create/Select Project**
   - Go to https://console.cloud.google.com
   - Create project: `marga-biz-insights`

2. **Enable APIs**
   - GA4 Data API: `analyticsdata.googleapis.com`
   - Search Console API: `searchconsole.googleapis.com`

3. **Create Service Account**
   - Name: `marga-insights-service`
   - Role: Viewer
   - Download JSON key → save as `insights-service-account.json`

4. **Grant Access**
   - GA4: Add service account email as Viewer in GA4 Admin
   - Search Console: Add service account email as User

### Environment Variables (Netlify)

```
GA4_PROPERTY_ID=123456789
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
SEARCH_CONSOLE_SITE_URL=https://marga.biz
```

---

## 📐 UI DESIGN

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│  MARGA INSIGHTS                    [Date Range ▼] [↻]  │
├─────────────────────────────────────────────────────────┤
│  [Overview] [Traffic] [Behavior] [SEO] [Conversions]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ Visitors│ │PageViews│ │ Clicks  │ │ Indexed │      │
│  │  1,234  │ │  5,678  │ │   89    │ │  1,903  │      │
│  │  ↑ 12%  │ │  ↑ 8%   │ │  ↑ 23%  │ │  ✓ 100% │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│                                                         │
│  ┌─────────────────────────┐ ┌─────────────────────┐   │
│  │   Traffic Over Time     │ │   Top Pages         │   │
│  │   📈 Line Chart         │ │   1. /              │   │
│  │                         │ │   2. /contact/      │   │
│  │                         │ │   3. /pricing/      │   │
│  └─────────────────────────┘ └─────────────────────┘   │
│                                                         │
│  ┌─────────────────────────┐ ┌─────────────────────┐   │
│  │   Traffic Sources       │ │   Top Keywords      │   │
│  │   🥧 Pie Chart          │ │   1. copier rental  │   │
│  │                         │ │   2. printer rental │   │
│  └─────────────────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```


### Tech Stack for UI

| Component | Library |
|-----------|---------|
| Charts | Chart.js or Recharts |
| Date Picker | Flatpickr |
| Tables | Native HTML + CSS |
| Icons | Lucide Icons |
| CSS Framework | Tailwind CSS (optional) |

---

## 🚀 IMPLEMENTATION PHASES

### Phase 3.1: Setup & Infrastructure
- [ ] Create Google Cloud project
- [ ] Enable GA4 Data API
- [ ] Enable Search Console API
- [ ] Create service account
- [ ] Set up Netlify environment variables
- [ ] Create basic admin/insights/ folder structure

### Phase 3.2: Backend (Netlify Functions)
- [ ] `insights-ga4.js` — Fetch traffic data
- [ ] `insights-ga4.js` — Fetch event data
- [ ] `insights-search.js` — Fetch indexing status
- [ ] `insights-search.js` — Fetch keyword rankings
- [ ] `insights-combined.js` — Combined dashboard endpoint
- [ ] Error handling & caching

### Phase 3.3: Frontend - Overview Dashboard
- [ ] Dashboard layout (HTML/CSS)
- [ ] KPI cards (visitors, pageviews, clicks, indexed)
- [ ] Traffic over time chart
- [ ] Top pages table
- [ ] Traffic sources pie chart
- [ ] Date range selector

### Phase 3.4: Frontend - Deep Dive Pages
- [ ] Traffic detail page
- [ ] Behavior analysis page
- [ ] SEO performance page
- [ ] Conversions page
- [ ] Export functionality (CSV)

### Phase 3.5: Polish & Security
- [ ] Firebase authentication integration
- [ ] Loading states & error handling
- [ ] Mobile responsive design
- [ ] Auto-refresh option
- [ ] Caching for performance

---

## 📋 DEPENDENCIES

Before building this module, we need:

1. **Firebase Authentication** (from Admin Module)
   - Can build a simple standalone auth first
   - Or build Admin Module Phase 1 first

2. **GA4 Property Access**
   - Property ID: G-L8XL675H9L (already have)
   - Service account access (need to set up)

3. **Search Console Access**
   - Site verified: marga.biz (likely already done)
   - Service account access (need to set up)

---

## 📝 NOTES

- Start with Overview dashboard, add detail pages incrementally
- Cache API responses (GA4 data doesn't change by the second)
- Consider rate limits: GA4 = 10,000 requests/day, Search Console = 200/minute
- Build mobile-responsive from the start

---

*Last Updated: January 10, 2026*
