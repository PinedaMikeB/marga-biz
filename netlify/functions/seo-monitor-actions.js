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
    'Printer Rental Philippines'
];
const DAILY_PRINTER_PAGES = [
    '/printer-rental/',
    '/printer-rental/bgc/',
    '/printer-rental/makati/',
    '/printer-rental/manila/',
    '/printer-rental/pasig/',
    '/printer-rental/quezon-city/'
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

    for (const keyword of DAILY_PRINTER_KEYWORDS) {
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
    const snapshot = await runInsightsSnapshot();
    const pageScans = await scanPrinterPages();

    const result = {
        ranAt: new Date().toISOString(),
        date: new Date().toISOString().slice(0, 10),
        focus: 'printer-only',
        rankings,
        competitors,
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

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Invalid action. Use run_today or track_keyword.' })
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
