const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const TIMEZONE = 'Asia/Manila';
const DEFAULT_DAYS = 5;
const DEFAULT_PRIORITY_KEYWORDS = [
    'Printer Rental',
    'Printer For Rent',
    'Print All You Can',
    'Printer Rental BGC',
    'Printer Rental Makati',
    'Printer Rental Manila',
    'Printer Rental Philippines'
];
const EXISTING_MONEY_PAGES = [
    '/printer-rental/',
    '/printer-rental/bgc/',
    '/printer-rental/makati/',
    '/printer-rental/manila/',
    '/printer-rental/pasig/'
];
const EXISTING_CITY_SUPPORT_PAGES = [
    '/printer-rental/quezon-city/',
    '/printer-rental/ortigas/',
    '/printer-rental/best-printer-rental-setup-bgc/',
    '/printer-rental/best-printer-rental-setup-manila/',
    '/printer-rental/best-printer-rental-setup-ortigas/'
];
const EXISTING_SUPPORT_REFRESH_PAGES = [
    '/printer-rental/how-to-choose-printer-rental-makati/',
    '/printer-rental/how-to-choose-printer-rental-pasig/',
    '/printer-rental/how-to-choose-printer-rental-quezon-city/',
    '/printer-rental/bgc/',
    '/printer-rental/makati/'
];
const EXISTING_BLOG_SUPPORT_PAGES = [
    '/printer-rental/how-much-does-printer-rental-cost/',
    '/printer-rental/how-is-printer-maintenance-handled-in-rentals/',
    '/printer-rental/how-do-i-choose-the-right-printer-rental-company/',
    '/printer-rental/comparing-printer-rentals/',
    '/printer-rental/cost-savings-printer-rental/'
];

function getServiceAccount() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    }

    const localPath = path.join(__dirname, '..', '..', 'service-account-key.json');
    if (fs.existsSync(localPath)) {
        return JSON.parse(fs.readFileSync(localPath, 'utf8'));
    }

    throw new Error('Google service account is not configured');
}

function getFirebaseApp() {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(getServiceAccount()),
            projectId: 'sah-spiritual-journal'
        });
    }

    return admin.app();
}

function normalizeKeyword(keyword = '') {
    return keyword.toLowerCase().trim().replace(/\s+/g, ' ');
}

function keywordToDocId(keyword = '') {
    return normalizeKeyword(keyword).replace(/\s+/g, '_');
}

function displayKeyword(keyword = '') {
    return keyword
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function isPrinterKeyword(keyword = '') {
    const normalized = normalizeKeyword(keyword);
    return normalized.includes('printer') || normalized === 'print all you can';
}

function formatDateKey(input) {
    const value = typeof input === 'string' ? input : input?.toISOString?.();
    if (!value) return '';
    return value.slice(0, 10);
}

function formatDateLabel(dateKey) {
    if (!dateKey) return '--';
    const date = new Date(`${dateKey}T12:00:00+08:00`);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        month: 'numeric',
        day: 'numeric',
        year: '2-digit'
    }).format(date);
}

function formatDateTime(value) {
    if (!value) return '--';
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
}

function dedupeKeywords(priorityKeywords, configuredKeywords) {
    const ordered = [];
    const seen = new Set();

    for (const keyword of [...priorityKeywords, ...configuredKeywords]) {
        const clean = keyword?.trim();
        if (!clean) continue;
        const normalized = normalizeKeyword(clean);
        if (!isPrinterKeyword(normalized)) continue;
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        ordered.push({
            label: clean,
            normalized
        });
    }

    return ordered;
}

function getRankingOpportunityValue(item) {
    return item?.latestPosition == null ? 999 : Number(item.latestPosition);
}

function pickWorstKeyword(rankings = [], matcher, fallback) {
    const pool = rankings
        .filter(item => !matcher || matcher(item))
        .sort((left, right) => getRankingOpportunityValue(right) - getRankingOpportunityValue(left));

    return pool[0]?.keyword || fallback;
}

function pickLowestScorePage(todayRun = {}, fallback = '/printer-rental/') {
    const pageScans = Array.isArray(todayRun.pageScans) ? todayRun.pageScans : [];
    const sorted = [...pageScans].sort((left, right) => {
        const leftScore = left.seoScore ?? 999;
        const rightScore = right.seoScore ?? 999;
        if (leftScore !== rightScore) return leftScore - rightScore;
        return (right.issueCount || 0) - (left.issueCount || 0);
    });

    return sorted[0]?.path || fallback;
}

function getKeywordTargetPath(keyword = '') {
    const normalized = normalizeKeyword(keyword);

    if (normalized.includes('bgc')) return '/printer-rental/bgc/';
    if (normalized.includes('makati')) return '/printer-rental/makati/';
    if (normalized.includes('manila')) return '/printer-rental/manila/';
    if (normalized.includes('pasig')) return '/printer-rental/pasig/';
    if (normalized.includes('quezon')) return '/printer-rental/quezon-city/';
    return '/printer-rental/';
}

function buildRecommendedDailyTasks(rankings = [], todayRun = null) {
    const weakestMoneyKeyword = pickWorstKeyword(
        rankings,
        item => /^printer rental$|^printer for rent$|^print all you can$/i.test(item.keyword),
        'Printer Rental'
    );
    const weakestCityKeyword = pickWorstKeyword(
        rankings,
        item => /\b(BGC|Makati|Manila)\b/i.test(item.keyword),
        'Printer Rental BGC'
    );
    const lowestScorePage = pickLowestScorePage(todayRun, '/printer-rental/');
    const primaryCompetitorKeyword = todayRun?.competitors?.keyword || 'Printer Rental Philippines';
    const weakestCityPath = getKeywordTargetPath(weakestCityKeyword);
    const weakestMoneyPath = getKeywordTargetPath(weakestMoneyKeyword);
    const moneyPageTargets = EXISTING_MONEY_PAGES.join(', ');
    const cityPageTargets = EXISTING_CITY_SUPPORT_PAGES.join(', ');
    const supportRefreshTargets = EXISTING_SUPPORT_REFRESH_PAGES.join(', ');
    const blogSupportTargets = EXISTING_BLOG_SUPPORT_PAGES.join(', ');

    return [
        {
            task: 'Improve 5 existing money pages today',
            implementation: 'Daily target: improve 5 existing printer money pages by tightening title tags, meta descriptions, H1/H2 flow, FAQ coverage, CTA copy, and supporting internal links across the live cluster.',
            targetPageKeyword: `${weakestMoneyKeyword} -> ${moneyPageTargets}`,
            status: 'Recommended',
            link: weakestMoneyPath || lowestScorePage
        },
        {
            task: 'Strengthen 5 weak city or service pages today',
            implementation: 'Daily target: improve 5 existing city or service pages with clearer local intent, supported service coverage, business-use copy, trust signals, and stronger quote CTAs instead of letting them sit as low-value pages.',
            targetPageKeyword: `${weakestCityKeyword} -> ${cityPageTargets}`,
            status: 'Recommended',
            link: weakestCityPath
        },
        {
            task: 'Refresh 5 existing support pages today',
            implementation: 'Daily target: review and upgrade 5 existing printer-rental support pages first so they stop occupying space for nothing and contribute to ranking the printer-rental cluster.',
            targetPageKeyword: supportRefreshTargets,
            status: 'Recommended',
            link: weakestCityPath
        },
        {
            task: 'Create up to 2 new support pages today',
            implementation: 'Daily target: create up to 2 new support pages only when a real supported keyword gap is confirmed after reviewing the existing printer-rental cluster, and only when the new pages will add unique business value.',
            targetPageKeyword: `${weakestCityKeyword}, printer rental taguig`,
            status: 'Recommended',
            link: weakestCityPath
        },
        {
            task: 'Publish 5 supporting blogs today',
            implementation: 'Daily target: publish 5 supporting blogs only when they answer real buyer objections, cover real use cases, and link back to the target printer landing pages with commercial intent. Refresh existing blog assets first when they are thin or overlapping.',
            targetPageKeyword: blogSupportTargets,
            status: 'Recommended',
            link: '/printer-rental/'
        },
        {
            task: 'Add 5 internal links today',
            implementation: 'Daily target: add 5 contextual internal links from existing printer pages and blog posts into the priority money page and the weakest city page.',
            targetPageKeyword: `${weakestMoneyKeyword}, ${weakestCityKeyword} -> ${moneyPageTargets}`,
            status: 'Recommended',
            link: lowestScorePage
        },
        {
            task: 'Fix 5 on-page SEO issues today',
            implementation: 'Daily target: resolve 5 concrete on-page issues on live printer pages such as title, meta, heading structure, canonical, schema, image alt text, or thin copy.',
            targetPageKeyword: `${weakestMoneyKeyword} -> ${moneyPageTargets}`,
            status: 'Recommended',
            link: lowestScorePage
        },
        {
            task: 'Add or refresh 5 FAQ and schema blocks today',
            implementation: 'Daily target: add or refresh FAQ content and valid schema on 5 existing printer pages where it improves commercial relevance, buyer intent coverage, and rich-result eligibility.',
            targetPageKeyword: `${weakestMoneyKeyword} -> ${supportRefreshTargets}`,
            status: 'Recommended',
            link: lowestScorePage
        },
        {
            task: 'Improve 5 conversion sections today',
            implementation: 'Daily target: strengthen 5 live printer pages with better quote CTAs, talk-to-sales prompts, form framing, or contact actions so traffic turns into leads.',
            targetPageKeyword: `${weakestMoneyKeyword} -> ${moneyPageTargets}`,
            status: 'Recommended',
            link: lowestScorePage
        },
        {
            task: 'Close 5 competitor gaps today',
            implementation: 'Daily target: use the competitor findings to add 5 missing trust signals, comparison angles, service inclusions, or buyer-proof sections across the existing printer-rental pages that matter most.',
            targetPageKeyword: `${primaryCompetitorKeyword} -> ${moneyPageTargets}`,
            status: 'Recommended',
            link: weakestMoneyPath
        }
    ];
}

function summarizeTask(task) {
    const payload = task.data || {};
    const title = payload.title || payload.slug || payload.keyword || task.title || task.type || 'SEO task';
    const taskName = task.type === 'create_page'
        ? `Create page: ${title}`
        : title;
    const link = payload.link
        || payload.path
        || (payload.slug ? `https://marga.biz/${String(payload.slug).replace(/^\/+|\/+$/g, '')}/` : null);

    return {
        timestamp: formatDateTime(task.completedAt || task.updatedAt || task.createdAt),
        task: taskName,
        link,
        status: (task.status || 'pending').toUpperCase()
    };
}

function summarizeActivity(item) {
    const details = item.details || {};
    const taskLabel = details.keyword
        ? `${item.action.replace(/_/g, ' ')}: ${details.keyword}`
        : item.action.replace(/_/g, ' ');

    return {
        timestamp: formatDateTime(item.timestamp),
        task: displayKeyword(taskLabel),
        link: details.url || details.path || null,
        status: 'LOG'
    };
}

async function getRecentTasks(db) {
    try {
        const snapshot = await db.collection('marga_tasks')
            .orderBy('createdAt', 'desc')
            .limit(8)
            .get();

        return snapshot.docs.map(doc => summarizeTask(doc.data()));
    } catch (error) {
        console.warn('Unable to load recent tasks:', error.message);
        return [];
    }
}

async function getRecentActivity(db) {
    try {
        const snapshot = await db.collection('marga_activity_log')
            .orderBy('timestamp', 'desc')
            .limit(8)
            .get();

        return snapshot.docs.map(doc => summarizeActivity(doc.data()));
    } catch (error) {
        console.warn('Unable to load recent activity:', error.message);
        return [];
    }
}

async function getConfig(db) {
    const doc = await db.collection('marga_config').doc('settings').get();
    return doc.exists ? doc.data() : {};
}

async function getSnapshotFallback(db, days) {
    try {
        const snapshot = await db.collection('insights_snapshots')
            .orderBy('date', 'desc')
            .limit(days)
            .get();

        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.warn('Unable to load insights snapshots:', error.message);
        return [];
    }
}

async function getLatestDailyRun(db) {
    try {
        const doc = await db.collection('marga_shared').doc('seo_monitor_daily_run').get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.warn('Unable to load latest SEO monitor run:', error.message);
        return null;
    }
}

async function getKeywordHistory(db, keywordLabel, days, snapshotFallbackMap) {
    const docId = keywordToDocId(keywordLabel);
    const ref = db.collection('marga_rankings').doc(docId);
    const doc = await ref.get();
    const positionsByDate = {};
    let latestPosition = null;

    if (doc.exists) {
        const data = doc.data();
        latestPosition = data.latestPosition ?? null;

        try {
            const history = await ref.collection('history')
                .orderBy('checkedAt', 'desc')
                .limit(Math.max(days * 2, 10))
                .get();

            history.forEach(item => {
                const entry = item.data();
                const dateKey = formatDateKey(entry.checkedAt);
                if (!dateKey || positionsByDate[dateKey] !== undefined) return;
                positionsByDate[dateKey] = entry.position ?? null;
            });
        } catch (error) {
            console.warn(`Unable to load ranking history for ${keywordLabel}:`, error.message);
        }
    }

    const snapshotFallback = snapshotFallbackMap[normalizeKeyword(keywordLabel)] || {};
    for (const [dateKey, position] of Object.entries(snapshotFallback)) {
        if (positionsByDate[dateKey] === undefined) {
            positionsByDate[dateKey] = position;
        }
    }

    const trendDates = Object.keys(positionsByDate).sort().slice(-2);
    const previousPosition = trendDates.length > 1 ? positionsByDate[trendDates[trendDates.length - 2]] : null;
    const delta = latestPosition != null && previousPosition != null
        ? previousPosition - latestPosition
        : null;

    return {
        keyword: keywordLabel,
        latestPosition,
        previousPosition,
        delta,
        positionsByDate
    };
}

function buildSnapshotFallbackMap(snapshots) {
    const map = {};

    for (const item of snapshots) {
        const dateKey = item.date;
        for (const keyword of item.searchConsole?.topKeywords || []) {
            const normalized = normalizeKeyword(keyword.keyword);
            if (!map[normalized]) map[normalized] = {};
            if (map[normalized][dateKey] === undefined) {
                map[normalized][dateKey] = keyword.position ?? null;
            }
        }
    }

    return map;
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const params = event.queryStringParameters || {};
        const days = Math.min(Math.max(parseInt(params.days, 10) || DEFAULT_DAYS, 2), 14);

        const db = admin.firestore(getFirebaseApp());
        const config = await getConfig(db);
        const configuredKeywords = [
            ...(config.seo?.keywords?.primary || []),
            ...(config.seo?.keywords?.growth || []),
            ...(config.seo?.keywords?.manual || [])
        ];
        const trackedKeywords = dedupeKeywords(DEFAULT_PRIORITY_KEYWORDS, configuredKeywords);
        const snapshots = await getSnapshotFallback(db, days);
        const snapshotFallbackMap = buildSnapshotFallbackMap(snapshots);

        const rankings = await Promise.all(
            trackedKeywords.map(item => getKeywordHistory(db, item.label, days, snapshotFallbackMap))
        );

        const allDateKeys = new Set();
        rankings.forEach(item => {
            Object.keys(item.positionsByDate || {}).forEach(dateKey => allDateKeys.add(dateKey));
        });
        snapshots.forEach(item => {
            if (item.date) allDateKeys.add(item.date);
        });

        const reportDates = Array.from(allDateKeys)
            .sort((a, b) => b.localeCompare(a))
            .slice(0, days)
            .map(dateKey => ({
                key: dateKey,
                label: formatDateLabel(dateKey)
            }));

        const recentTasks = await getRecentTasks(db);
        const recentActivity = recentTasks.length > 0 ? recentTasks : await getRecentActivity(db);
        const latestSnapshot = snapshots[0] || null;
        const latestDailyRun = await getLatestDailyRun(db);
        const activeAutomations = buildRecommendedDailyTasks(rankings, latestDailyRun);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                generatedAt: new Date().toISOString(),
                timezone: TIMEZONE,
                reportDates,
                rankings,
                logs: recentActivity,
                dailyTasks: activeAutomations,
                todayRun: latestDailyRun,
                meta: {
                    keywordsTracked: trackedKeywords.length,
                    latestSnapshotDate: latestSnapshot?.date || null,
                    openTaskCount: recentTasks.filter(item => item.status !== 'DONE').length,
                    sourceCollections: [
                        'marga_config',
                        'marga_rankings',
                        'insights_snapshots',
                        'marga_tasks',
                        'marga_activity_log',
                        'marga_shared'
                    ]
                }
            })
        };
    } catch (error) {
        console.error('SEO monitor report error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};
