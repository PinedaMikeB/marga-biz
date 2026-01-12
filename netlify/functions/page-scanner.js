/**
 * Marga AI - Deep Page Scanner
 * Scans pages for full SEO data: title, meta, headings, content, links
 * 
 * Scan Types:
 * - initial: Full scan of all pages (one-time)
 * - delta: Only new/modified pages (daily)
 * - targeted: Single page on-demand (before AI works on it)
 */

const admin = require('firebase-admin');

const getFirebaseApp = () => {
    if (admin.apps.length === 0) {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'sah-spiritual-journal'
        });
    }
    return admin.app();
};

const GITHUB_API = 'https://api.github.com';
const REPO_OWNER = 'PinedaMikeB';
const REPO_NAME = 'marga-biz';
const SITE_URL = 'https://marga.biz';

/**
 * Fetch page HTML from GitHub (faster than live site)
 */
async function fetchPageFromGitHub(path) {
    const token = process.env.GITHUB_TOKEN;
    
    // Convert URL path to file path
    let filePath = path === '/' ? 'dist/index.html' : `dist${path}index.html`;
    if (!filePath.endsWith('index.html')) {
        filePath = filePath.replace(/\/$/, '') + '/index.html';
    }
    
    try {
        const response = await fetch(
            `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (!response.ok) {
            // Try without /index.html
            const altPath = filePath.replace('/index.html', '.html');
            const altResponse = await fetch(
                `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${altPath}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            if (!altResponse.ok) return null;
            const data = await altResponse.json();
            return Buffer.from(data.content, 'base64').toString('utf-8');
        }
        
        const data = await response.json();
        return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (e) {
        console.error(`Error fetching ${path}:`, e.message);
        return null;
    }
}

/**
 * Fetch page from live site (fallback)
 */
async function fetchPageFromSite(path) {
    try {
        const url = `${SITE_URL}${path}`;
        const response = await fetch(url, { 
            headers: { 'User-Agent': 'MargaAI-Scanner/1.0' }
        });
        if (!response.ok) return null;
        return await response.text();
    } catch (e) {
        return null;
    }
}

/**
 * Extract SEO data from HTML
 */
function extractPageData(html, path) {
    const data = {
        path,
        url: `${SITE_URL}${path}`,
        title: '',
        metaDescription: '',
        canonical: '',
        h1: '',
        h2s: [],
        h3s: [],
        wordCount: 0,
        internalLinks: [],
        externalLinks: [],
        images: [],
        hasSchema: false,
        schemaTypes: [],
        issues: [],
        seoScore: 0
    };

    // Extract title
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    data.title = titleMatch ? titleMatch[1].trim() : '';

    // Extract meta description
    const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ||
                      html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
    data.metaDescription = metaMatch ? metaMatch[1].trim() : '';

    // Extract canonical
    const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
    data.canonical = canonicalMatch ? canonicalMatch[1].trim() : '';

    // Extract H1
    const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
    data.h1 = h1Match ? h1Match[1].trim().replace(/<[^>]+>/g, '') : '';

    // Extract H2s
    const h2Matches = html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/gi);
    for (const match of h2Matches) {
        const text = match[1].trim().replace(/<[^>]+>/g, '');
        if (text) data.h2s.push(text);
    }

    // Extract H3s
    const h3Matches = html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/gi);
    for (const match of h3Matches) {
        const text = match[1].trim().replace(/<[^>]+>/g, '');
        if (text) data.h3s.push(text);
    }

    // Count words (strip HTML, count)
    const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    data.wordCount = textContent.split(' ').filter(w => w.length > 2).length;

    // Extract internal links
    const linkMatches = html.matchAll(/<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>/gi);
    for (const match of linkMatches) {
        const href = match[1];
        if (href.startsWith('/') || href.includes('marga.biz')) {
            const cleanHref = href.replace(SITE_URL, '').split('?')[0];
            if (cleanHref && !data.internalLinks.includes(cleanHref)) {
                data.internalLinks.push(cleanHref);
            }
        } else if (href.startsWith('http')) {
            if (!data.externalLinks.includes(href)) {
                data.externalLinks.push(href);
            }
        }
    }

    // Extract images
    const imgMatches = html.matchAll(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi);
    for (const match of imgMatches) {
        const src = match[1];
        const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
        data.images.push({
            src,
            alt: altMatch ? altMatch[1] : '',
            hasAlt: !!altMatch && altMatch[1].length > 0
        });
    }

    // Check for schema markup
    if (html.includes('application/ld+json')) {
        data.hasSchema = true;
        const schemaMatches = html.matchAll(/"@type"\s*:\s*"([^"]+)"/g);
        for (const match of schemaMatches) {
            if (!data.schemaTypes.includes(match[1])) {
                data.schemaTypes.push(match[1]);
            }
        }
    }

    // Calculate SEO score and issues
    const { score, issues } = calculateSEOScore(data);
    data.seoScore = score;
    data.issues = issues;

    return data;
}

/**
 * Calculate SEO score and identify issues
 */
function calculateSEOScore(data) {
    let score = 100;
    const issues = [];

    // Title checks (25 points)
    if (!data.title) {
        score -= 25;
        issues.push({ type: 'missing_title', severity: 'critical', message: 'Missing page title' });
    } else if (data.title.length < 30) {
        score -= 10;
        issues.push({ type: 'title_too_short', severity: 'warning', message: `Title too short (${data.title.length} chars, recommend 50-60)` });
    } else if (data.title.length > 70) {
        score -= 5;
        issues.push({ type: 'title_too_long', severity: 'minor', message: `Title too long (${data.title.length} chars, recommend 50-60)` });
    }

    // Meta description checks (20 points)
    if (!data.metaDescription) {
        score -= 20;
        issues.push({ type: 'missing_meta', severity: 'critical', message: 'Missing meta description' });
    } else if (data.metaDescription.length < 120) {
        score -= 10;
        issues.push({ type: 'meta_too_short', severity: 'warning', message: `Meta description too short (${data.metaDescription.length} chars, recommend 150-160)` });
    } else if (data.metaDescription.length > 170) {
        score -= 5;
        issues.push({ type: 'meta_too_long', severity: 'minor', message: `Meta description too long (${data.metaDescription.length} chars)` });
    }

    // H1 checks (15 points)
    if (!data.h1) {
        score -= 15;
        issues.push({ type: 'missing_h1', severity: 'critical', message: 'Missing H1 heading' });
    }

    // Content length (15 points)
    if (data.wordCount < 300) {
        score -= 15;
        issues.push({ type: 'thin_content', severity: 'warning', message: `Thin content (${data.wordCount} words, recommend 500+)` });
    } else if (data.wordCount < 500) {
        score -= 5;
        issues.push({ type: 'low_content', severity: 'minor', message: `Low word count (${data.wordCount} words)` });
    }

    // Internal links (10 points)
    if (data.internalLinks.length < 3) {
        score -= 10;
        issues.push({ type: 'few_internal_links', severity: 'warning', message: `Only ${data.internalLinks.length} internal links (recommend 5+)` });
    }

    // Images (10 points)
    const imagesWithoutAlt = data.images.filter(img => !img.hasAlt);
    if (imagesWithoutAlt.length > 0) {
        score -= Math.min(10, imagesWithoutAlt.length * 2);
        issues.push({ type: 'missing_alt', severity: 'warning', message: `${imagesWithoutAlt.length} images missing alt text` });
    }

    // Schema (5 points)
    if (!data.hasSchema) {
        score -= 5;
        issues.push({ type: 'missing_schema', severity: 'minor', message: 'No structured data (schema.org) found' });
    }

    return { score: Math.max(0, score), issues };
}

/**
 * Convert path to safe Firebase document ID
 */
function pathToDocId(path) {
    return path.replace(/\//g, '_').replace(/^_/, '').replace(/_$/, '') || 'homepage';
}

/**
 * Scan a single page
 */
async function scanPage(db, path) {
    // Try GitHub first, then live site
    let html = await fetchPageFromGitHub(path);
    if (!html) {
        html = await fetchPageFromSite(path);
    }
    
    if (!html) {
        return { success: false, path, error: 'Could not fetch page' };
    }

    const pageData = extractPageData(html, path);
    pageData.lastScanned = new Date().toISOString();
    pageData.scanType = 'targeted';

    // Store in Firebase
    const docId = pathToDocId(path);
    await db.collection('marga_pages').doc(docId).set(pageData);

    return { success: true, path, data: pageData };
}

/**
 * Get page data from Firebase (with optional fresh scan)
 */
async function getPageData(db, path, maxAge = 24 * 60 * 60 * 1000) {
    const docId = pathToDocId(path);
    const doc = await db.collection('marga_pages').doc(docId).get();
    
    if (doc.exists) {
        const data = doc.data();
        const age = Date.now() - new Date(data.lastScanned).getTime();
        
        if (age < maxAge) {
            return { fresh: true, data };
        }
    }
    
    // Need to scan
    const result = await scanPage(db, path);
    if (result.success) {
        return { fresh: false, data: result.data };
    }
    
    return doc.exists ? { fresh: false, data: doc.data() } : null;
}

/**
 * Initial scan - scan all pages from sitemap
 */
async function initialScan(db, limit = 50) {
    // Get pages from site structure
    const summaryDoc = await db.collection('marga_site').doc('summary').get();
    if (!summaryDoc.exists) {
        return { error: 'Run site-scanner first to get page list' };
    }

    // Get key pages to scan (most important ones)
    const keyPagesDoc = await db.collection('marga_site').doc('key_pages').get();
    const keyPages = keyPagesDoc.exists ? keyPagesDoc.data().pages : [];
    
    const results = { scanned: 0, success: 0, failed: 0, pages: [] };
    const pagesToScan = keyPages.slice(0, limit);

    for (const page of pagesToScan) {
        results.scanned++;
        try {
            const result = await scanPage(db, page.path);
            if (result.success) {
                results.success++;
                results.pages.push({ path: page.path, score: result.data.seoScore });
            } else {
                results.failed++;
            }
        } catch (e) {
            results.failed++;
            console.error(`Error scanning ${page.path}:`, e.message);
        }
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 100));
    }

    // Update index
    await db.collection('marga_pages').doc('_index').set({
        lastFullScan: new Date().toISOString(),
        totalScanned: results.success,
        scanType: 'initial'
    }, { merge: true });

    return results;
}

/**
 * Get pages with issues
 */
async function getPagesWithIssues(db, severity = null, limit = 20) {
    const snapshot = await db.collection('marga_pages')
        .where('seoScore', '<', 80)
        .orderBy('seoScore', 'asc')
        .limit(limit)
        .get();

    const pages = [];
    snapshot.forEach(doc => {
        if (doc.id !== '_index') {
            const data = doc.data();
            if (!severity || data.issues.some(i => i.severity === severity)) {
                pages.push({
                    path: data.path,
                    title: data.title,
                    seoScore: data.seoScore,
                    issues: data.issues
                });
            }
        }
    });

    return pages;
}

/**
 * Main handler
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const app = getFirebaseApp();
        const db = admin.firestore(app);
        
        const params = event.queryStringParameters || {};
        const action = params.action || 'get';

        switch (action) {
            case 'scan': {
                // Scan a single page
                const path = params.path || '/';
                const result = await scanPage(db, path);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, data: result })
                };
            }

            case 'get': {
                // Get page data (scan if stale)
                const path = params.path || '/';
                const maxAge = parseInt(params.maxAge) || 24 * 60 * 60 * 1000;
                const result = await getPageData(db, path, maxAge);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, data: result })
                };
            }

            case 'initial': {
                // Initial scan of key pages
                const limit = parseInt(params.limit) || 50;
                const result = await initialScan(db, limit);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, data: result })
                };
            }

            case 'issues': {
                // Get pages with issues
                const severity = params.severity || null;
                const limit = parseInt(params.limit) || 20;
                const pages = await getPagesWithIssues(db, severity, limit);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, data: { pages, count: pages.length } })
                };
            }

            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid action. Use: scan, get, initial, issues' })
                };
        }

    } catch (error) {
        console.error('Page Scanner Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
