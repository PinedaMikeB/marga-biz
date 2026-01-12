/**
 * Marga AI - Agent Tools
 * 
 * Direct tool functions that Manager can call immediately.
 * These are the "MCP-style" tools - synchronous, immediate results.
 */

const admin = require('firebase-admin');

// Initialize Firebase if needed
const getDb = () => {
    if (admin.apps.length === 0) {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'sah-spiritual-journal'
        });
    }
    return admin.firestore();
};

/**
 * TOOL: Scan a page for SEO issues
 * Returns actual page data, not guesses
 */
async function scanPage(pagePath) {
    try {
        // Normalize path
        let path = pagePath;
        if (path.startsWith('http')) {
            // Extract path from full URL
            const url = new URL(path);
            path = url.pathname;
        }
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        if (!path.endsWith('/')) {
            path = path + '/';
        }
        
        // Call the existing page-scanner function with correct parameters
        const response = await fetch(
            `https://marga.biz/.netlify/functions/page-scanner?action=scan&path=${encodeURIComponent(path)}`
        );
        const result = await response.json();
        
        if (result.success && result.data) {
            const data = result.data;
            return {
                success: true,
                path: data.path,
                url: data.url || `https://marga.biz${path}`,
                title: data.title,
                titleLength: data.title?.length || 0,
                metaDescription: data.metaDescription,
                metaLength: data.metaDescription?.length || 0,
                h1: data.h1,
                h2Count: data.h2s?.length || 0,
                wordCount: data.wordCount,
                seoScore: data.seoScore,
                grade: data.grade,
                issues: data.issues || [],
                passed: data.passed || [],
                internalLinks: data.internalLinks?.length || 0,
                externalLinks: data.externalLinks?.length || 0,
                images: data.images?.length || 0,
                imagesWithoutAlt: data.images?.filter(i => !i.hasAlt)?.length || 0,
                hasSchema: data.hasSchema,
                canonical: data.canonical
            };
        }
        return { success: false, error: result.error || 'Scan failed - no data returned' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * TOOL: Check live SERP ranking
 * Returns real-time Google ranking data
 */
async function checkRanking(keyword) {
    try {
        const response = await fetch(
            `https://marga.biz/.netlify/functions/agent-search?action=quick_check&keyword=${encodeURIComponent(keyword)}`
        );
        const result = await response.json();
        
        if (result.success && result.data) {
            return {
                success: true,
                keyword: result.data.keyword,
                yourPosition: result.data.margaPosition,
                top10: result.data.top10,
                checkedAt: result.data.checkedAt
            };
        }
        return { success: false, error: result.data?.error || result.error || 'Check failed' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * TOOL: Find competitors for a keyword
 */
async function findCompetitors(keyword) {
    try {
        const response = await fetch(
            `https://marga.biz/.netlify/functions/agent-search?action=find_competitors&keyword=${encodeURIComponent(keyword)}`
        );
        const result = await response.json();
        
        if (result.success && result.data) {
            return {
                success: true,
                keyword: result.data.keyword,
                yourRanking: result.data.yourRanking,
                directCompetitors: result.data.directCompetitors,
                opportunities: result.data.opportunities
            };
        }
        return { success: false, error: result.error || 'Failed to find competitors' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * TOOL: Get page from Firebase cache
 * Quick access to already-scanned pages
 */
async function getCachedPage(pagePath) {
    try {
        const db = getDb();
        const docId = pagePath.replace(/\//g, '_').replace(/^_|_$/g, '') || 'home';
        const doc = await db.collection('marga_pages').doc(docId).get();
        
        if (doc.exists) {
            const data = doc.data();
            return {
                success: true,
                cached: true,
                scannedAt: data.scannedAt,
                ...data
            };
        }
        return { success: false, error: 'Page not in cache', cached: false };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * TOOL: Get Search Console data for a keyword
 */
async function getSearchConsoleData(keyword) {
    try {
        const db = getDb();
        
        // Get latest snapshot
        const snapshot = await db.collection('insights_snapshots')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return { success: false, error: 'No Search Console data available' };
        }
        
        const data = snapshot.docs[0].data();
        const topKeywords = data.seo?.topKeywords || [];
        
        // Find matching keyword
        const match = topKeywords.find(k => 
            k.query?.toLowerCase().includes(keyword.toLowerCase()) ||
            keyword.toLowerCase().includes(k.query?.toLowerCase())
        );
        
        return {
            success: true,
            keyword,
            match: match || null,
            relatedKeywords: topKeywords.filter(k => 
                k.query?.toLowerCase().includes('printer') || 
                k.query?.toLowerCase().includes('rental') ||
                k.query?.toLowerCase().includes('copier')
            ).slice(0, 10),
            dataDate: data.date
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * TOOL: Get site overview
 */
async function getSiteOverview() {
    try {
        const db = getDb();
        
        // Get key pages
        const keyPagesDoc = await db.collection('marga_site').doc('key_pages').get();
        const summaryDoc = await db.collection('marga_site').doc('summary').get();
        
        const keyPages = keyPagesDoc.exists ? keyPagesDoc.data() : null;
        const summary = summaryDoc.exists ? summaryDoc.data() : null;
        
        // Get recent scans
        const recentScans = await db.collection('marga_pages')
            .orderBy('scannedAt', 'desc')
            .limit(10)
            .get();
        
        const recentPages = recentScans.docs.map(d => ({
            path: d.data().path,
            score: d.data().seoScore,
            grade: d.data().grade,
            scannedAt: d.data().scannedAt
        }));
        
        return {
            success: true,
            totalPages: keyPages?.pages?.length || summary?.totalPages || 0,
            scannedPages: recentPages.length,
            recentScans: recentPages,
            lastScan: recentPages[0]?.scannedAt || null
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = {
    scanPage,
    checkRanking,
    findCompetitors,
    getCachedPage,
    getSearchConsoleData,
    getSiteOverview
};
