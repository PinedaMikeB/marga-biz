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
    const { score, grade, issues, passed } = calculateSEOScore(data);
    data.seoScore = score;
    data.seoGrade = grade;
    data.issues = issues;
    data.passed = passed;

    return data;
}

/**
 * Calculate SEO score and identify issues (Yoast-style)
 * 
 * Scoring Breakdown (100 points total):
 * - Title: 15 points (existence, length, unique)
 * - Meta Description: 15 points (existence, length)
 * - H1: 10 points (existence, uniqueness)
 * - Content: 20 points (word count, structure)
 * - Headings: 10 points (H2s, hierarchy)
 * - Internal Links: 10 points (quantity)
 * - Images: 10 points (alt text)
 * - Technical: 10 points (schema, canonical)
 */
function calculateSEOScore(data) {
    let score = 0;
    const issues = [];
    const passed = [];

    // === TITLE (15 points) ===
    if (!data.title) {
        issues.push({ type: 'missing_title', severity: 'critical', message: 'Missing page title', points: -15 });
    } else {
        const titleLen = data.title.length;
        if (titleLen >= 50 && titleLen <= 60) {
            score += 15;
            passed.push({ type: 'title_perfect', message: `Title length is ideal (${titleLen} chars)` });
        } else if (titleLen >= 30 && titleLen <= 70) {
            score += 10;
            issues.push({ type: 'title_length', severity: 'minor', message: `Title length (${titleLen}) could be optimized (50-60 recommended)`, points: -5 });
        } else if (titleLen < 30) {
            score += 5;
            issues.push({ type: 'title_too_short', severity: 'warning', message: `Title too short (${titleLen} chars, need 50-60)`, points: -10 });
        } else {
            score += 5;
            issues.push({ type: 'title_too_long', severity: 'warning', message: `Title too long (${titleLen} chars, may be truncated)`, points: -10 });
        }
    }

    // === META DESCRIPTION (15 points) ===
    if (!data.metaDescription) {
        issues.push({ type: 'missing_meta', severity: 'critical', message: 'Missing meta description - critical for CTR', points: -15 });
    } else {
        const metaLen = data.metaDescription.length;
        if (metaLen >= 150 && metaLen <= 160) {
            score += 15;
            passed.push({ type: 'meta_perfect', message: `Meta description length is ideal (${metaLen} chars)` });
        } else if (metaLen >= 120 && metaLen <= 170) {
            score += 10;
            issues.push({ type: 'meta_length', severity: 'minor', message: `Meta description (${metaLen}) could be optimized (150-160 recommended)`, points: -5 });
        } else if (metaLen < 120) {
            score += 5;
            issues.push({ type: 'meta_too_short', severity: 'warning', message: `Meta description too short (${metaLen} chars)`, points: -10 });
        } else {
            score += 5;
            issues.push({ type: 'meta_too_long', severity: 'warning', message: `Meta description too long (${metaLen} chars, will be truncated)`, points: -10 });
        }
    }

    // === H1 HEADING (10 points) ===
    if (!data.h1) {
        issues.push({ type: 'missing_h1', severity: 'critical', message: 'Missing H1 heading - every page needs one', points: -10 });
    } else {
        score += 10;
        passed.push({ type: 'h1_present', message: 'H1 heading present' });
    }

    // === CONTENT LENGTH (20 points) ===
    const words = data.wordCount || 0;
    if (words >= 1000) {
        score += 20;
        passed.push({ type: 'content_excellent', message: `Excellent content length (${words} words)` });
    } else if (words >= 500) {
        score += 15;
        passed.push({ type: 'content_good', message: `Good content length (${words} words)` });
    } else if (words >= 300) {
        score += 10;
        issues.push({ type: 'content_low', severity: 'warning', message: `Content could be longer (${words} words, aim for 500+)`, points: -10 });
    } else if (words >= 100) {
        score += 5;
        issues.push({ type: 'thin_content', severity: 'warning', message: `Thin content (${words} words) - add more value`, points: -15 });
    } else {
        issues.push({ type: 'very_thin_content', severity: 'critical', message: `Very thin content (${words} words) - needs significant expansion`, points: -20 });
    }

    // === HEADING STRUCTURE (10 points) ===
    const h2Count = data.h2s?.length || 0;
    if (h2Count >= 3) {
        score += 10;
        passed.push({ type: 'headings_good', message: `Good heading structure (${h2Count} H2s)` });
    } else if (h2Count >= 1) {
        score += 5;
        issues.push({ type: 'few_headings', severity: 'minor', message: `Only ${h2Count} H2 heading(s) - add more sections`, points: -5 });
    } else {
        issues.push({ type: 'no_h2s', severity: 'warning', message: 'No H2 headings - content lacks structure', points: -10 });
    }

    // === INTERNAL LINKS (10 points) ===
    const linkCount = data.internalLinks?.length || 0;
    if (linkCount >= 5) {
        score += 10;
        passed.push({ type: 'links_good', message: `Good internal linking (${linkCount} links)` });
    } else if (linkCount >= 2) {
        score += 5;
        issues.push({ type: 'few_links', severity: 'minor', message: `Only ${linkCount} internal links - add more`, points: -5 });
    } else {
        issues.push({ type: 'no_links', severity: 'warning', message: 'Very few internal links - hurts SEO', points: -10 });
    }

    // === IMAGES (10 points) ===
    const images = data.images || [];
    const imagesWithAlt = images.filter(img => img.hasAlt).length;
    const imagesWithoutAlt = images.length - imagesWithAlt;
    
    if (images.length === 0) {
        score += 5; // No images isn't terrible
        issues.push({ type: 'no_images', severity: 'minor', message: 'No images - consider adding visuals', points: -5 });
    } else if (imagesWithoutAlt === 0) {
        score += 10;
        passed.push({ type: 'images_good', message: `All ${images.length} images have alt text` });
    } else {
        score += 5;
        issues.push({ type: 'missing_alt', severity: 'warning', message: `${imagesWithoutAlt}/${images.length} images missing alt text`, points: -5 });
    }

    // === TECHNICAL (10 points) ===
    let techScore = 0;
    if (data.hasSchema) {
        techScore += 5;
        passed.push({ type: 'has_schema', message: 'Schema markup present' });
    } else {
        issues.push({ type: 'missing_schema', severity: 'minor', message: 'No schema markup - add LocalBusiness schema', points: -5 });
    }
    
    if (data.canonical) {
        techScore += 5;
        passed.push({ type: 'has_canonical', message: 'Canonical URL set' });
    } else {
        issues.push({ type: 'missing_canonical', severity: 'minor', message: 'No canonical URL specified', points: -5 });
    }
    score += techScore;

    // Determine overall grade
    let grade = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';

    return { 
        score: Math.max(0, Math.min(100, score)), 
        grade,
        issues: issues.sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1, minor: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        }),
        passed 
    };
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
    
    // Check which pages are already scanned (within 24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    const pagesToScan = [];
    
    for (const page of keyPages) {
        if (pagesToScan.length >= limit) break;
        
        const docId = page.path.replace(/\//g, '_').replace(/^_/, '').replace(/_$/, '') || 'homepage';
        const existingDoc = await db.collection('marga_pages').doc(docId).get();
        
        if (!existingDoc.exists) {
            // Not scanned yet
            pagesToScan.push(page);
        } else {
            const data = existingDoc.data();
            const lastScanned = data.lastScanned ? new Date(data.lastScanned).getTime() : 0;
            if (now - lastScanned > maxAge) {
                // Stale, needs rescan
                pagesToScan.push(page);
            }
            // else: recently scanned, skip
        }
    }
    
    if (pagesToScan.length === 0) {
        return { scanned: 0, success: 0, failed: 0, skipped: keyPages.length, message: 'All pages already scanned within 24 hours' };
    }
    
    const results = { scanned: 0, success: 0, failed: 0, skipped: keyPages.length - pagesToScan.length, pages: [] };

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
