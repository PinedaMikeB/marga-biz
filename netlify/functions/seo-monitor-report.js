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

function buildRecommendedDailyTasks(config = {}) {
    const schedules = config.seo?.schedules || {};

    const scheduleStatus = (key, fallback = 'Planned') => {
        if (!schedules[key]) return fallback;
        if (schedules[key].enabled === true) return 'Active';
        if (schedules[key].enabled === false) return 'Off';
        return fallback;
    };

    return [
        {
            task: 'Capture printer keyword rankings',
            implementation: 'Run SERP checks for the core printer money keywords and save the latest positions to Firebase.',
            status: 'Recommended',
            link: '/.netlify/functions/seo-monitor-actions'
        },
        {
            task: 'Store daily analytics and Search Console snapshot',
            implementation: 'Save GA4 and Search Console data into `insights_snapshots` so ranking and traffic trends stay visible.',
            status: scheduleStatus('dailySnapshot'),
            link: '/.netlify/functions/seo-monitor-actions'
        },
        {
            task: 'Watch for ranking drops on printer pages',
            implementation: 'Compare today versus yesterday for Printer Rental, Printer For Rent, Print All You Can, BGC, Makati, and Manila keywords.',
            status: scheduleStatus('keywordAlerts'),
            link: '/automations/seo-monitor/'
        },
        {
            task: 'Track printer SERP competitors',
            implementation: 'Log the domains ranking above marga.biz for printer rental terms and keep the strongest competing page visible.',
            status: scheduleStatus('competitorCheck', 'Recommended'),
            link: '/.netlify/functions/seo-monitor-actions'
        },
        {
            task: 'Scan key printer landing pages',
            implementation: 'Review crawlability, titles, canonicals, headings, links, and schema on the main printer hub and city pages.',
            status: 'Recommended',
            link: '/.netlify/functions/seo-monitor-actions'
        },
        {
            task: 'Create one next-best printer SEO action',
            implementation: 'Turn the day’s printer ranking or competitor findings into one concrete content, internal-link, or technical action.',
            status: 'Recommended',
            link: '/automations/seo-monitor/'
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
            ...(config.seo?.keywords?.growth || [])
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
        const activeAutomations = buildRecommendedDailyTasks(config);
        const latestSnapshot = snapshots[0] || null;
        const latestDailyRun = await getLatestDailyRun(db);

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
