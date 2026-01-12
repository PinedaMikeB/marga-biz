/**
 * Marga AI - Website Scanner
 * Scans sitemap.xml and stores full site structure in Firebase
 * Gives AI complete knowledge of all pages
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
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
 * Store site structure in Firebase
 */
async function storeSiteStructure(db, pages) {
    const batch = db.batch();
    
    // Store summary
    const summaryRef = db.collection('marga_site').doc('summary');
    const categoryCounts = {};
    
    pages.forEach(page => {
        categoryCounts[page.category] = (categoryCounts[page.category] || 0) + 1;
    });
    
    batch.set(summaryRef, {
        totalPages: pages.length,
        categories: categoryCounts,
        lastScanned: new Date().toISOString(),
        sitemapUrl: SITEMAP_URL
    });
    
    await batch.commit();
    
    // Store pages in chunks (Firestore batch limit is 500)
    const chunks = [];
    for (let i = 0; i < pages.length; i += 400) {
        chunks.push(pages.slice(i, i + 400));
    }
    
    for (let i = 0; i < chunks.length; i++) {
        const chunkBatch = db.batch();
        const chunkRef = db.collection('marga_site').doc(`pages_${i}`);
        chunkBatch.set(chunkRef, { 
            pages: chunks[i],
            chunkIndex: i,
            count: chunks[i].length
        });
        await chunkBatch.commit();
    }
    
    // Store key pages separately for quick access
    const keyPages = pages.filter(p => 
        p.category === 'homepage' || 
        p.category === 'service' || 
        p.category === 'conversion' ||
        p.category === 'pricing'
    ).slice(0, 100);
    
    await db.collection('marga_site').doc('key_pages').set({
        pages: keyPages,
        count: keyPages.length
    });
    
    return {
        totalPages: pages.length,
        categories: categoryCounts,
        keyPagesStored: keyPages.length
    };
}

/**
 * Get site structure from Firebase
 */
async function getSiteStructure(db) {
    const summaryDoc = await db.collection('marga_site').doc('summary').get();
    
    if (!summaryDoc.exists) {
        return null;
    }
    
    const summary = summaryDoc.data();
    
    // Get key pages
    const keyPagesDoc = await db.collection('marga_site').doc('key_pages').get();
    const keyPages = keyPagesDoc.exists ? keyPagesDoc.data().pages : [];
    
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
        const app = getFirebaseApp();
        const db = admin.firestore(app);
        
        const params = event.queryStringParameters || {};
        const action = params.action || 'get';

        if (action === 'scan') {
            // Scan sitemap and store in Firebase
            const urls = await fetchSitemap();
            const pages = urls.map(url => extractPageInfo(url));
            const result = await storeSiteStructure(db, pages);
            
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
            const structure = await getSiteStructure(db);
            
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
