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
        // Convert URL path to file path
        // /printer-rental/ -> dist/printer-rental/index.html
        let filePath = pagePath;
        if (filePath.startsWith('/')) {
            filePath = filePath.slice(1);
        }
        if (filePath.endsWith('/')) {
            filePath = filePath.slice(0, -1);
        }
        if (!filePath.includes('.html')) {
            filePath = filePath ? `dist/${filePath}/index.html` : 'dist/index.html';
        }
        
        // First, get the current file content
        const getResponse = await fetch(
            `https://marga.biz/.netlify/functions/github-editor?action=get&path=${encodeURIComponent(filePath)}`
        );
        const getResult = await getResponse.json();
        
        if (!getResult.success || !getResult.data?.content) {
            return { success: false, error: `Cannot read file ${filePath}: ${getResult.error || 'No content'}` };
        }
        
        let content = getResult.data.content;
        let modified = false;
        const changesMade = [];
        
        // Update title tag
        if (changes.title) {
            const titleRegex = /<title>([^<]*)<\/title>/i;
            if (titleRegex.test(content)) {
                const oldTitle = content.match(titleRegex)[1];
                content = content.replace(titleRegex, `<title>${changes.title}</title>`);
                changesMade.push(`Title: "${oldTitle}" → "${changes.title}"`);
                modified = true;
            } else {
                return { success: false, error: 'Title tag not found in file' };
            }
        }
        
        // Update meta description
        if (changes.metaDescription) {
            const metaRegex = /<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i;
            if (metaRegex.test(content)) {
                content = content.replace(metaRegex, `<meta name="description" content="${changes.metaDescription}">`);
                changesMade.push(`Meta description updated`);
                modified = true;
            }
        }
        
        if (!modified) {
            return { success: false, error: 'No changes could be applied to the file' };
        }
        
        // Save the updated content via GitHub API
        const updateResponse = await fetch(
            `https://marga.biz/.netlify/functions/github-editor?action=update&path=${encodeURIComponent(filePath)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: content,
                    message: `SEO update: ${changesMade.join(', ')}`
                })
            }
        );
        
        const updateResult = await updateResponse.json();
        
        if (updateResult.success) {
            return {
                success: true,
                message: 'Page updated successfully! Changes will be live in ~30 seconds after Netlify deploys.',
                changes: changesMade,
                filePath: filePath,
                commitUrl: updateResult.data?.commitUrl
            };
        } else {
            return { success: false, error: updateResult.error || 'Failed to save changes' };
        }
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * TOOL: Scan a competitor's page for SEO analysis
 * Fetches and parses competitor HTML to extract SEO elements
 */
async function scanCompetitor(url) {
    try {
        // Validate URL
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }
        
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        // Don't scan our own site with this tool
        if (domain.includes('marga.biz')) {
            return { 
                success: false, 
                error: 'Use scan_page for marga.biz pages, not scan_competitor' 
            };
        }
        
        // Fetch the competitor page
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout (reduced from 10)
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; MargaSEOBot/1.0; +https://marga.biz)',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            return { 
                success: false, 
                error: `Failed to fetch: HTTP ${response.status}` 
            };
        }
        
        const html = await response.text();
        
        // Parse SEO elements from HTML
        const result = {
            success: true,
            url: url,
            domain: domain,
            fetchedAt: new Date().toISOString()
        };
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        result.title = titleMatch ? titleMatch[1].trim() : null;
        result.titleLength = result.title?.length || 0;
        
        // Extract meta description
        const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i) ||
                             html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["'][^>]*>/i);
        result.metaDescription = metaDescMatch ? metaDescMatch[1].trim() : null;
        result.metaLength = result.metaDescription?.length || 0;
        
        // Extract H1
        const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
        result.h1 = h1Match ? h1Match[1].trim().replace(/\s+/g, ' ') : null;
        
        // Count H2s
        const h2Matches = html.match(/<h2[^>]*>([^<]*)<\/h2>/gi) || [];
        result.h2s = h2Matches.map(h2 => {
            const match = h2.match(/<h2[^>]*>([^<]*)<\/h2>/i);
            return match ? match[1].trim().replace(/\s+/g, ' ') : '';
        }).filter(h => h.length > 0).slice(0, 10); // First 10 H2s
        result.h2Count = result.h2s.length;
        
        // Count H3s
        const h3Matches = html.match(/<h3[^>]*>/gi) || [];
        result.h3Count = h3Matches.length;
        
        // Estimate word count (strip HTML, count words)
        const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        result.wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
        
        // Check for schema markup
        result.hasSchema = html.includes('application/ld+json') || 
                          html.includes('itemtype="http://schema.org') ||
                          html.includes('itemtype="https://schema.org');
        
        // Check for Open Graph tags
        result.hasOpenGraph = html.includes('og:title') || html.includes('og:description');
        
        // Extract canonical URL
        const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["'][^>]*>/i) ||
                              html.match(/<link\s+href=["']([^"']*)["']\s+rel=["']canonical["'][^>]*>/i);
        result.canonical = canonicalMatch ? canonicalMatch[1] : null;
        
        // Count images and images with alt text
        const imgMatches = html.match(/<img[^>]+>/gi) || [];
        result.imageCount = imgMatches.length;
        result.imagesWithAlt = imgMatches.filter(img => img.includes('alt=')).length;
        
        // Check for common SEO elements
        result.seoElements = {
            hasTitle: !!result.title,
            hasMeta: !!result.metaDescription,
            hasH1: !!result.h1,
            hasSchema: result.hasSchema,
            hasCanonical: !!result.canonical,
            titleOptimal: result.titleLength >= 30 && result.titleLength <= 60,
            metaOptimal: result.metaLength >= 120 && result.metaLength <= 160
        };
        
        // Generate quick analysis
        const strengths = [];
        const weaknesses = [];
        
        if (result.titleLength >= 30 && result.titleLength <= 60) {
            strengths.push(`Good title length (${result.titleLength} chars)`);
        } else if (result.titleLength > 0) {
            weaknesses.push(`Title ${result.titleLength < 30 ? 'too short' : 'too long'} (${result.titleLength} chars)`);
        } else {
            weaknesses.push('Missing title tag');
        }
        
        if (result.metaLength >= 120 && result.metaLength <= 160) {
            strengths.push(`Good meta description length (${result.metaLength} chars)`);
        } else if (result.metaLength > 0) {
            weaknesses.push(`Meta description ${result.metaLength < 120 ? 'too short' : 'too long'} (${result.metaLength} chars)`);
        } else {
            weaknesses.push('Missing meta description');
        }
        
        if (result.h1) {
            strengths.push('Has H1 heading');
        } else {
            weaknesses.push('Missing H1 heading');
        }
        
        if (result.h2Count >= 3) {
            strengths.push(`Good heading structure (${result.h2Count} H2s)`);
        } else if (result.h2Count > 0) {
            weaknesses.push(`Few subheadings (only ${result.h2Count} H2s)`);
        } else {
            weaknesses.push('No H2 subheadings');
        }
        
        if (result.wordCount >= 1000) {
            strengths.push(`Strong content length (${result.wordCount} words)`);
        } else if (result.wordCount >= 500) {
            strengths.push(`Decent content (${result.wordCount} words)`);
        } else {
            weaknesses.push(`Thin content (only ${result.wordCount} words)`);
        }
        
        if (result.hasSchema) {
            strengths.push('Has schema markup');
        }
        
        result.strengths = strengths;
        result.weaknesses = weaknesses;
        
        return result;
        
    } catch (e) {
        if (e.name === 'AbortError') {
            return { success: false, error: 'Request timed out (5 seconds) - competitor site may be slow' };
        }
        return { success: false, error: e.message };
    }
}

/**
 * TOOL: Compare your page with a competitor
 * Runs scan_page and scan_competitor, then compares
 */
async function compareWithCompetitor(yourPath, competitorUrl) {
    try {
        // Scan your page
        const yourPage = await scanPage(yourPath);
        if (!yourPage.success) {
            return { success: false, error: `Failed to scan your page: ${yourPage.error}` };
        }
        
        // Scan competitor
        const competitor = await scanCompetitor(competitorUrl);
        if (!competitor.success) {
            return { success: false, error: `Failed to scan competitor: ${competitor.error}` };
        }
        
        // Build comparison
        const comparison = {
            success: true,
            yourPage: {
                url: yourPage.url,
                title: yourPage.title,
                titleLength: yourPage.titleLength,
                metaDescription: yourPage.metaDescription,
                metaLength: yourPage.metaLength,
                h1: yourPage.h1,
                h2Count: yourPage.h2Count,
                wordCount: yourPage.wordCount,
                hasSchema: yourPage.hasSchema,
                seoScore: yourPage.seoScore
            },
            competitor: {
                url: competitor.url,
                domain: competitor.domain,
                title: competitor.title,
                titleLength: competitor.titleLength,
                metaDescription: competitor.metaDescription,
                metaLength: competitor.metaLength,
                h1: competitor.h1,
                h2Count: competitor.h2Count,
                wordCount: competitor.wordCount,
                hasSchema: competitor.hasSchema
            },
            analysis: {
                youWin: [],
                theyWin: [],
                recommendations: []
            }
        };
        
        // Compare title
        if (yourPage.titleLength > 0 && competitor.titleLength > 0) {
            if (yourPage.titleLength >= 30 && yourPage.titleLength <= 60 && 
                (competitor.titleLength < 30 || competitor.titleLength > 60)) {
                comparison.analysis.youWin.push('Better optimized title length');
            } else if (competitor.titleLength >= 30 && competitor.titleLength <= 60 && 
                      (yourPage.titleLength < 30 || yourPage.titleLength > 60)) {
                comparison.analysis.theyWin.push('Better optimized title length');
                comparison.analysis.recommendations.push(`Optimize your title to 30-60 chars (currently ${yourPage.titleLength})`);
            }
        }
        
        // Compare meta description
        if (yourPage.metaLength > 0 && competitor.metaLength > 0) {
            if (yourPage.metaLength >= 120 && yourPage.metaLength <= 160 && 
                (competitor.metaLength < 120 || competitor.metaLength > 160)) {
                comparison.analysis.youWin.push('Better meta description length');
            } else if (competitor.metaLength >= 120 && competitor.metaLength <= 160 && 
                      (yourPage.metaLength < 120 || yourPage.metaLength > 160)) {
                comparison.analysis.theyWin.push('Better meta description length');
                comparison.analysis.recommendations.push(`Optimize meta description to 120-160 chars (currently ${yourPage.metaLength})`);
            }
        }
        
        // Compare content length
        const wordDiff = yourPage.wordCount - competitor.wordCount;
        if (wordDiff >= 200) {
            comparison.analysis.youWin.push(`More content (+${wordDiff} words)`);
        } else if (wordDiff <= -200) {
            comparison.analysis.theyWin.push(`More content (+${Math.abs(wordDiff)} words)`);
            comparison.analysis.recommendations.push(`Add more content (competitor has ${competitor.wordCount} words vs your ${yourPage.wordCount})`);
        }
        
        // Compare headings
        if (yourPage.h2Count >= competitor.h2Count + 2) {
            comparison.analysis.youWin.push('Better heading structure');
        } else if (competitor.h2Count >= yourPage.h2Count + 2) {
            comparison.analysis.theyWin.push('Better heading structure');
            comparison.analysis.recommendations.push(`Add more H2 subheadings (competitor has ${competitor.h2Count}, you have ${yourPage.h2Count})`);
        }
        
        // Compare schema
        if (yourPage.hasSchema && !competitor.hasSchema) {
            comparison.analysis.youWin.push('Has schema markup (they don\'t)');
        } else if (competitor.hasSchema && !yourPage.hasSchema) {
            comparison.analysis.theyWin.push('Has schema markup');
            comparison.analysis.recommendations.push('Add schema markup to your page');
        }
        
        // Summary
        comparison.summary = {
            yourAdvantages: comparison.analysis.youWin.length,
            theirAdvantages: comparison.analysis.theyWin.length,
            verdict: comparison.analysis.youWin.length > comparison.analysis.theyWin.length 
                ? 'Your page is better optimized overall' 
                : comparison.analysis.theyWin.length > comparison.analysis.youWin.length
                    ? 'Competitor page is better optimized - see recommendations'
                    : 'Pages are similarly optimized'
        };
        
        return comparison;
        
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
    editPageSEO,
    scanCompetitor,
    compareWithCompetitor
};
