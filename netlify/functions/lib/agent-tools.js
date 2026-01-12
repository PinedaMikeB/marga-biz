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
            const url = new URL(path);
            path = url.pathname;
        }
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        if (!path.endsWith('/')) {
            path = path + '/';
        }
        
        // Call the existing page-scanner function
        const response = await fetch(
            `https://marga.biz/.netlify/functions/page-scanner?action=scan&path=${encodeURIComponent(path)}`
        );
        const result = await response.json();
        
        // Handle nested response structure: result.data.data contains actual page data
        if (result.success && result.data) {
            // The actual data might be in result.data.data (nested) or result.data directly
            const pageData = result.data.data || result.data;
            
            if (pageData.title || pageData.h1 || pageData.wordCount) {
                return {
                    success: true,
                    path: pageData.path || path,
                    url: pageData.url || `https://marga.biz${path}`,
                    title: pageData.title,
                    titleLength: pageData.title?.length || 0,
                    metaDescription: pageData.metaDescription,
                    metaLength: pageData.metaDescription?.length || 0,
                    h1: pageData.h1,
                    h2s: pageData.h2s || [],
                    h2Count: pageData.h2s?.length || 0,
                    h3s: pageData.h3s || [],
                    wordCount: pageData.wordCount || 0,
                    seoScore: pageData.seoScore,
                    grade: pageData.grade,
                    issues: pageData.issues || [],
                    passed: pageData.passed || [],
                    internalLinks: Array.isArray(pageData.internalLinks) ? pageData.internalLinks : [],
                    internalLinkCount: Array.isArray(pageData.internalLinks) ? pageData.internalLinks.length : 0,
                    externalLinks: Array.isArray(pageData.externalLinks) ? pageData.externalLinks : [],
                    externalLinkCount: Array.isArray(pageData.externalLinks) ? pageData.externalLinks.length : 0,
                    images: pageData.images || [],
                    imageCount: pageData.images?.length || 0,
                    hasSchema: pageData.hasSchema,
                    canonical: pageData.canonical
                };
            }
        }
        return { success: false, error: result.error || 'Scan returned no usable data' };
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

/**
 * TOOL: Edit a page's SEO elements (title, meta description)
 * Uses GitHub API to update the actual file
 */
async function editPageSEO(pagePath, changes) {
    try {
        // First, get the current file content
        const getResponse = await fetch(
            `https://marga.biz/.netlify/functions/github-editor?action=get&path=${encodeURIComponent(pagePath)}`
        );
        const getResult = await getResponse.json();
        
        if (!getResult.success) {
            return { success: false, error: `Cannot read file: ${getResult.error}` };
        }
        
        let content = getResult.data.content;
        let modified = false;
        const changesMade = [];
        
        // Update title tag
        if (changes.title) {
            const titleRegex = /<title>([^<]*)<\/title>/i;
            if (titleRegex.test(content)) {
                content = content.replace(titleRegex, `<title>${changes.title}</title>`);
                changesMade.push(`Title: "${changes.title}"`);
                modified = true;
            }
        }
        
        // Update meta description
        if (changes.metaDescription) {
            const metaRegex = /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i;
            const newMeta = `<meta name="description" content="${changes.metaDescription}">`;
            if (metaRegex.test(content)) {
                content = content.replace(metaRegex, newMeta);
                changesMade.push(`Meta description updated`);
                modified = true;
            }
        }
        
        if (!modified) {
            return { success: false, error: 'No changes could be applied to the file' };
        }
        
        // Save the updated content
        const updateResponse = await fetch('https://marga.biz/.netlify/functions/github-editor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update',
                path: pagePath,
                content: content,
                message: `SEO update: ${changesMade.join(', ')}`
            })
        });
        
        const updateResult = await updateResponse.json();
        
        if (updateResult.success) {
            return {
                success: true,
                message: 'Page updated successfully!',
                changes: changesMade,
                path: pagePath,
                commitUrl: updateResult.data?.commit?.html_url
            };
        } else {
            return { success: false, error: updateResult.error };
        }
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
    getSiteOverview,
    editPageSEO
};
