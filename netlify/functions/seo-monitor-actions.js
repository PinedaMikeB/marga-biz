const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SERPER_API_URL = 'https://google.serper.dev/search';
const TARGET_DOMAIN = 'marga.biz';
const SITE_ORIGIN = process.env.URL || 'https://marga.biz';
const DAILY_PRINTER_KEYWORDS = [
    'Printer Rental',
    'Printer For Rent',
    'Print All You Can',
    'Printer Rental BGC',
    'Printer Rental Makati',
    'Printer Rental Manila',
    'Printer Rental Philippines',
    'Printer Rental Taguig'
];
const DAILY_COPIER_KEYWORDS = [
    'Copier Rental',
    'Copier For Rent',
    'Copier Rental BGC',
    'Copier Rental Makati',
    'Copier Rental Manila',
    'Copier Rental Taguig',
    'Copier Rental Quezon City',
    'Copier Rental Pasig',
    'Copier Rental Ortigas',
    'Copier Rental Philippines'
];
const DAILY_PRINTER_PAGES = [
    '/printer-rental/',
    '/printer-rental/bgc/',
    '/printer-rental/makati/',
    '/printer-rental/manila/',
    '/printer-rental/pasig/',
    '/printer-rental/quezon-city/'
];

function getManilaDateKey(input = new Date()) {
    const date = input instanceof Date ? input : new Date(input);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

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

function getDb() {
    return admin.firestore(getFirebaseApp());
}

function normalizeKeyword(keyword = '') {
    return keyword.toLowerCase().trim().replace(/\s+/g, ' ');
}

function keywordToDocId(keyword = '') {
    return normalizeKeyword(keyword).replace(/\s+/g, '_');
}

function extractDomain(url) {
    try {
        const target = new URL(url);
        return target.hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

async function searchGoogle(query) {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        throw new Error('SERPER_API_KEY is not configured on Netlify.');
    }

    const response = await fetch(SERPER_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey
        },
        body: JSON.stringify({
            q: query,
            gl: 'ph',
            hl: 'en',
            num: 20
        })
    });

    if (!response.ok) {
        throw new Error(`Serper API error: ${response.status} ${await response.text()}`);
    }

    return response.json();
}

async function checkRanking(keyword, targetDomain = TARGET_DOMAIN) {
    const results = await searchGoogle(keyword);
    const organic = results.organic || [];
    const competitors = [];
    let ranking = null;

    for (let index = 0; index < organic.length; index += 1) {
        const result = organic[index];
        const position = result.position || index + 1;
        const domain = extractDomain(result.link);

        if (domain.includes(targetDomain)) {
            ranking = {
                position,
                url: result.link,
                title: result.title,
                snippet: result.snippet
            };
            continue;
        }

        competitors.push({
            position,
            domain,
            url: result.link,
            title: result.title
        });
    }

    return {
        keyword,
        ranking,
        notFound: !ranking,
        competitors: competitors.slice(0, 10),
        relatedSearches: (results.relatedSearches || []).slice(0, 5),
        peopleAlsoAsk: (results.peopleAlsoAsk || []).slice(0, 5),
        checkedAt: new Date().toISOString()
    };
}

async function storeRankingHistory(db, keyword, result) {
    const docId = keywordToDocId(keyword);
    const docRef = db.collection('marga_rankings').doc(docId);

    await docRef.set({
        keyword,
        latestPosition: result.ranking?.position || null,
        latestCheck: result.checkedAt,
        latestUrl: result.ranking?.url || null,
        notRanking: !result.ranking
    }, { merge: true });

    await docRef.collection('history').add({
        position: result.ranking?.position || null,
        url: result.ranking?.url || null,
        competitors: result.competitors.slice(0, 5).map((item) => ({
            domain: item.domain,
            position: item.position
        })),
        checkedAt: result.checkedAt
    });
}

async function addTrackedKeyword(db, keyword) {
    const ref = db.collection('marga_config').doc('settings');
    const snapshot = await ref.get();
    const current = snapshot.exists ? snapshot.data() : {};
    const seo = current.seo || {};
    const keywords = seo.keywords || {};
    const manual = Array.isArray(keywords.manual) ? keywords.manual : [];

    if (manual.some((item) => normalizeKeyword(item) === normalizeKeyword(keyword))) {
        return manual;
    }

    const nextManual = [...manual, keyword];
    await ref.set({
        seo: {
            ...seo,
            keywords: {
                ...keywords,
                manual: nextManual
            }
        }
    }, { merge: true });

    return nextManual;
}

async function logActivity(db, action, details) {
    await db.collection('marga_activity_log').add({
        agent: 'seo_monitor',
        action,
        details,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function recordTaskCompletion(db, payload) {
    const taskKey = String(payload.taskKey || '').trim();
    const task = String(payload.task || '').trim();
    const implementation = String(payload.implementation || '').trim();
    const targetPageKeyword = String(payload.targetPageKeyword || '').trim();
    const link = String(payload.link || '').trim();
    const status = String(payload.status || 'Done').trim();

    if (!taskKey) throw new Error('taskKey is required.');
    if (!task) throw new Error('task is required.');
    if (!implementation) throw new Error('implementation is required.');
    if (!link) throw new Error('link is required.');

    const date = payload.date || getManilaDateKey();
    const docId = `${date}__${taskKey}`;
    const completion = {
        date,
        taskKey,
        task,
        implementation,
        targetPageKeyword,
        link,
        status,
        completedAt: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('seo_monitor_task_completions').doc(docId).set(completion, { merge: true });
    await logActivity(db, 'seo_monitor_task_completed', {
        taskKey,
        task,
        link,
        status
    });

    return {
        ...completion,
        updatedAt: undefined
    };
}

function normalizeAutomationStatus(value = '') {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return 'Scheduled';
    if (text === 'running') return 'Running';
    if (text === 'done' || text === 'completed' || text === 'success') return 'Done';
    if (text === 'failed' || text === 'error') return 'Failed';
    if (text === 'blocked') return 'Blocked';
    if (text === 'scheduled' || text === 'idle' || text === 'waiting') return 'Scheduled';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

async function updateAutomationStatus(db, payload) {
    const automationId = String(payload.automationId || 'printer-seo-daily').trim();
    const status = normalizeAutomationStatus(payload.status);
    const currentStep = String(payload.currentStep || '').trim();
    const message = String(payload.message || '').trim();
    const liveLogExcerpt = String(payload.liveLogExcerpt || '').trim();
    const lastMessageExcerpt = String(payload.lastMessageExcerpt || '').trim();
    const runId = String(payload.runId || '').trim();
    const runLog = String(payload.runLog || '').trim();
    const lastMessageFile = String(payload.lastMessageFile || '').trim();
    const heartbeat = Boolean(payload.heartbeat);
    const ref = db.collection('marga_shared').doc('seo_monitor_automation_status');
    const currentDoc = await ref.get();
    const current = currentDoc.exists ? currentDoc.data() : {};
    const nowIso = String(payload.updatedAt || new Date().toISOString());

    const next = {
        automationId,
        name: String(payload.name || current.name || 'Printer SEO Daily'),
        source: String(payload.source || current.source || 'launchd'),
        runner: String(payload.runner || current.runner || 'codex-cli'),
        mode: String(payload.mode || current.mode || 'local-launchd'),
        status,
        currentStep: currentStep || current.currentStep || '',
        message: message || current.message || '',
        liveLogExcerpt: liveLogExcerpt || current.liveLogExcerpt || '',
        lastMessageExcerpt: lastMessageExcerpt || current.lastMessageExcerpt || '',
        runId: runId || current.runId || '',
        runLog: runLog || current.runLog || '',
        lastMessageFile: lastMessageFile || current.lastMessageFile || '',
        timezone: String(payload.timezone || current.timezone || 'Asia/Manila'),
        targetHour: payload.targetHour ?? current.targetHour ?? null,
        targetMinute: payload.targetMinute ?? current.targetMinute ?? null,
        nextRunAt: payload.nextRunAt || current.nextRunAt || null,
        startedAt: payload.startedAt || current.startedAt || null,
        finishedAt: payload.finishedAt || current.finishedAt || null,
        lastSuccessAt: payload.lastSuccessAt || current.lastSuccessAt || null,
        lastFailureAt: payload.lastFailureAt || current.lastFailureAt || null,
        queueStatus: payload.queueStatus || current.queueStatus || null,
        latestReportGeneratedAt: payload.latestReportGeneratedAt || current.latestReportGeneratedAt || null,
        completedTasks: Array.isArray(payload.completedTasks) ? payload.completedTasks.slice(0, 20) : (current.completedTasks || []),
        updatedAtIso: nowIso,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (status === 'Running' && payload.startedAt) {
        next.finishedAt = null;
        next.queueStatus = null;
        next.completedTasks = [];
        next.latestReportGeneratedAt = null;
    }

    if ((status === 'Scheduled' || status === 'Failed' || status === 'Blocked') && payload.queueStatus == null) {
        next.queueStatus = current.queueStatus || null;
    }

    await ref.set(next, { merge: true });

    if (!heartbeat) {
        await db.collection('seo_monitor_automation_events').add({
            automationId,
            status,
            currentStep: next.currentStep,
            message: next.message,
            runId: next.runId || null,
            source: next.source,
            runner: next.runner,
            updatedAtIso: nowIso,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await logActivity(db, 'seo_monitor_automation_status', {
            automationId,
            status,
            currentStep: next.currentStep,
            message: next.message
        });
    }

    return next;
}

async function callSiteFunction(endpoint) {
    const response = await fetch(`${SITE_ORIGIN}${endpoint}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
        throw new Error(payload.error || `Unable to complete ${endpoint}`);
    }

    return payload;
}

async function runInsightsSnapshot() {
    try {
        const payload = await callSiteFunction('/.netlify/functions/insights-snapshot');
        return {
            success: true,
            date: payload.data?.date || null,
            clicks: payload.data?.searchConsole?.clicks || 0
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function scanPrinterPages() {
    const scans = [];

    for (const pagePath of DAILY_PRINTER_PAGES) {
        try {
            const payload = await callSiteFunction(`/.netlify/functions/page-scanner?action=scan&path=${encodeURIComponent(pagePath)}`);
            const pageData = payload.data?.data || {};

            scans.push({
                path: pagePath,
                success: true,
                seoScore: pageData.seoScore ?? null,
                grade: pageData.seoGrade || null,
                issueCount: pageData.issues?.length || 0
            });
        } catch (error) {
            scans.push({
                path: pagePath,
                success: false,
                error: error.message
            });
        }
    }

    return scans;
}

function buildCompetitorSummary(result) {
    return {
        keyword: result.keyword,
        topDomains: result.competitors.slice(0, 5).map((item) => ({
            domain: item.domain,
            position: item.position,
            url: item.url
        })),
        peopleAlsoAsk: result.peopleAlsoAsk.map((item) => item.question || item.title || item),
        relatedSearches: result.relatedSearches.map((item) => item.query || item)
    };
}

async function runToday(db) {
    const rankings = [];

    for (const keyword of [...DAILY_PRINTER_KEYWORDS, ...DAILY_COPIER_KEYWORDS]) {
        const result = await checkRanking(keyword);
        await storeRankingHistory(db, keyword, result);
        rankings.push({
            keyword,
            position: result.ranking?.position || null,
            url: result.ranking?.url || null,
            notFound: result.notFound
        });

        await logActivity(db, 'seo_monitor_keyword_check', {
            keyword,
            position: result.ranking?.position || null,
            url: result.ranking?.url || null
        });
    }

    const competitorSource = await checkRanking('Printer Rental Philippines');
    const competitors = buildCompetitorSummary(competitorSource);
    const copierCompetitorSource = await checkRanking('Copier Rental Philippines');
    const copierCompetitors = buildCompetitorSummary(copierCompetitorSource);
    const snapshot = await runInsightsSnapshot();
    const pageScans = await scanPrinterPages();

    const result = {
        ranAt: new Date().toISOString(),
        date: new Date().toISOString().slice(0, 10),
        focus: 'printer-and-copier-local',
        rankings,
        competitors,
        copierCompetitors,
        snapshot,
        pageScans
    };

    await db.collection('marga_shared').doc('seo_monitor_daily_run').set({
        ...result,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await logActivity(db, 'seo_monitor_daily_run', {
        keywordChecks: rankings.length,
        snapshotSaved: snapshot.success,
        pageScans: pageScans.length,
        focus: result.focus
    });

    return result;
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Use POST for SEO monitor actions.' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const action = body.action || 'run_today';
        const db = getDb();

        if (action === 'track_keyword') {
            const keyword = String(body.keyword || '').trim();
            if (!keyword) {
                throw new Error('Keyword is required.');
            }

            const result = await checkRanking(keyword);
            await storeRankingHistory(db, keyword, result);
            await addTrackedKeyword(db, keyword);
            await logActivity(db, 'seo_monitor_track_keyword', {
                keyword,
                position: result.ranking?.position || null,
                url: result.ranking?.url || null
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: result
                })
            };
        }

        if (action === 'run_today') {
            const result = await runToday(db);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: result
                })
            };
        }

        if (action === 'complete_task') {
            const result = await recordTaskCompletion(db, body);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: result
                })
            };
        }

        if (action === 'update_automation_status') {
            const result = await updateAutomationStatus(db, body);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: result
                })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Invalid action. Use run_today, track_keyword, complete_task, or update_automation_status.' })
        };
    } catch (error) {
        console.error('SEO monitor action error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
