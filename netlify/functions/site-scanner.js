/**
 * Marga AI - Website Scanner
 * Scans sitemap.xml and stores full site structure in Postgres
 * Gives AI complete knowledge of all pages
 */
const { getDoc, setDoc } = require('./lib/marga-doc-store');

const SITEMAP_URL = 'https://marga.biz/sitemap.xml';

/**
 * Fetch and parse sitemap
 */
async function fetchSitemap() {
    const response = await fetch(SITEMAP_URL);
    const xml = await response.text();
    
    // Parse URLs from sitemap
    const urlMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
    const urls = [];
    
    for (const match of urlMatches) {
        urls.push(match[1]);
    }
    
    return urls;
}

/**
 * Categorize page by URL
 */
function categorizePage(url) {
    const path = url.replace('https://marga.biz', '');
    
    if (path === '/' || path === '') return 'homepage';
    if (path.includes('/blog/') || path.includes('/printer-rental/') && path.split('/').length > 3) return 'blog';
    if (path.includes('/copier-') || path.includes('/printer-')) return 'service';
    if (path.includes('/contact') || path.includes('/about') || path.includes('/quote')) return 'conversion';
    if (path.includes('/pricing')) return 'pricing';
    return 'other';
}

/**
 * Extract page info from URL
 */
function extractPageInfo(url) {
    const path = url.replace('https://marga.biz', '') || '/';
    const parts = path.split('/').filter(Boolean);
    
    // Generate title from URL
    let title = 'Home';
    if (parts.length > 0) {
        title = parts[parts.length - 1]
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return {
        url,
        path,
        title,
        category: categorizePage(url),
        depth: parts.length
    };
}

/**
 * Store site structure in Postgres
 */
async function storeSiteStructure(pages) {
    // Store summary
    const categoryCounts = {};
    
    pages.forEach(page => {
        categoryCounts[page.category] = (categoryCounts[page.category] || 0) + 1;
    });
    
    await setDoc('marga_site', 'summary', {
        totalPages: pages.length,
        categories: categoryCounts,
        lastScanned: new Date().toISOString(),
        sitemapUrl: SITEMAP_URL
    });

    // Store pages in chunks (Firestore batch limit is 500)
    const chunks = [];
    for (let i = 0; i < pages.length; i += 400) {
        chunks.push(pages.slice(i, i + 400));
    }
    
    for (let i = 0; i < chunks.length; i++) {
        await setDoc('marga_site', `pages_${i}`, {
            pages: chunks[i],
            chunkIndex: i,
            count: chunks[i].length
        });
    }
    
    // Store key pages separately for quick access (PRIORITY ORDER)
    // Priority 1: Money pages (homepage, quote, contact, pricing)
    // Priority 2: Main service pages (short URLs)
    // Priority 3: Deep service pages
    // Priority 4: Blog posts
    
    const priorityPages = [];
    
    // Priority 1: Money pages
    const moneyPaths = ['/', '/quote/', '/contact/', '/pricing/'];
    moneyPaths.forEach(path => {
        const found = pages.find(p => p.path === path);
        if (found) priorityPages.push({ ...found, priority: 1 });
    });
    
    // Priority 2: Main service pages (depth 2-3, contains rental/copier/printer)
    pages.forEach(p => {
        if (priorityPages.some(pp => pp.path === p.path)) return;
        if (p.depth <= 3 && (p.path.includes('rental') || p.path.includes('copier') || p.path.includes('printer'))) {
            priorityPages.push({ ...p, priority: 2 });
        }
    });
    
    // Priority 3: Other service pages
    pages.forEach(p => {
        if (priorityPages.some(pp => pp.path === p.path)) return;
        if (p.category === 'service') {
            priorityPages.push({ ...p, priority: 3 });
        }
    });
    
    // Priority 4: Blog posts (limit to 50)
    let blogCount = 0;
    pages.forEach(p => {
        if (priorityPages.some(pp => pp.path === p.path)) return;
        if (p.category === 'blog' && blogCount < 50) {
            priorityPages.push({ ...p, priority: 4 });
            blogCount++;
        }
    });
    
    // Sort by priority, then by depth (shallower first)
    priorityPages.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.depth - b.depth;
    });
    
    // Limit to 200 key pages
    const keyPages = priorityPages.slice(0, 200);
    
    await setDoc('marga_site', 'key_pages', {
        pages: keyPages,
        count: keyPages.length,
        lastUpdated: new Date().toISOString()
    });
    
    return {
        totalPages: pages.length,
        categories: categoryCounts,
        keyPagesStored: keyPages.length
    };
}

/**
 * Get site structure from Postgres
 */
async function getSiteStructure() {
    const summary = await getDoc('marga_site', 'summary');

    if (!summary) {
        return null;
    }

    // Get key pages
    const keyPagesDoc = await getDoc('marga_site', 'key_pages');
    const keyPages = keyPagesDoc?.pages || [];
    
    return {
        ...summary,
        keyPages
    };
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
        const params = event.queryStringParameters || {};
        const action = params.action || 'get';

        if (action === 'scan') {
            // Scan sitemap and store in Postgres
            const urls = await fetchSitemap();
            const pages = urls.map(url => extractPageInfo(url));
            const result = await storeSiteStructure(pages);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Site structure scanned and stored',
                    data: result
                })
            };
        }
        
        if (action === 'get') {
            // Get stored site structure
            const structure = await getSiteStructure();
            
            if (!structure) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        message: 'No site structure stored. Run ?action=scan first.'
                    })
                };
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data: structure })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid action. Use: scan, get' })
        };

    } catch (error) {
        console.error('Site Scanner Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
