/**
 * Marga Website Static Site Generator v2.0
 * 
 * Generates ALL 896 pages + 1007 blog posts from WordPress export
 * Preserves all SEO metadata to maintain #2 Google ranking
 * 
 * Usage: node scripts/generate-site.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    baseUrl: 'https://marga.biz',
    siteName: 'Marga Enterprises - Copier & Printer Rental',
    firebaseStorage: 'https://firebasestorage.googleapis.com/v0/b/sah-spiritual-journal.firebasestorage.app/o/public%2Fwebsite%2F',
    defaultOgImage: 'https://firebasestorage.googleapis.com/v0/b/sah-spiritual-journal.firebasestorage.app/o/public%2Fwebsite%2Fog-image.png?alt=media',
    distDir: path.join(__dirname, '../dist'),
    dataDir: path.join(__dirname, '../data'),
    templatesDir: path.join(__dirname, '../templates'),
    componentsDir: path.join(__dirname, '../components'),
    cssDir: path.join(__dirname, '../css'),
    jsDir: path.join(__dirname, '../js')
};

// Stats tracking
const stats = {
    pages: 0,
    posts: 0,
    errors: [],
    startTime: Date.now()
};

console.log('🚀 Marga Static Site Generator v2.0\n');
console.log('=' .repeat(50));

// ============================================
// LOAD DATA AND TEMPLATES
// ============================================

function loadData() {
    console.log('\n📁 Loading data files...');
    
    const wpDataPath = path.join(CONFIG.dataDir, 'wordpress-data.json');
    if (!fs.existsSync(wpDataPath)) {
        console.error('❌ WordPress data not found at:', wpDataPath);
        process.exit(1);
    }
    
    const wpData = JSON.parse(fs.readFileSync(wpDataPath, 'utf8'));
    console.log(`   ✅ Loaded ${wpData.pages?.length || 0} pages`);
    console.log(`   ✅ Loaded ${wpData.posts?.length || 0} posts`);
    
    return wpData;
}

// Build URL mapping for fixing broken internal links
function buildUrlMap(wpData) {
    console.log('\n🔗 Building URL map for internal links...');
    
    const urlMap = {};
    
    // Map all pages by their slug
    for (const page of (wpData.pages || [])) {
        if (page.slug && page.link) {
            const fullPath = page.link.replace('https://marga.biz', '').replace('http://marga.biz', '');
            urlMap[page.slug] = fullPath;
        }
    }
    
    // Map all posts by their slug
    for (const post of (wpData.posts || [])) {
        if (post.slug && post.link) {
            const fullPath = post.link.replace('https://marga.biz', '').replace('http://marga.biz', '');
            urlMap[post.slug] = fullPath;
        }
    }
    
    console.log(`   ✅ Mapped ${Object.keys(urlMap).length} URLs`);
    return urlMap;
}

function loadTemplates() {
    console.log('\n📄 Loading templates...');
    
    const templates = {};
    const templateFiles = ['base.html', 'page.html', 'blog-post.html'];
    
    for (const file of templateFiles) {
        const filePath = path.join(CONFIG.templatesDir, file);
        if (fs.existsSync(filePath)) {
            templates[file.replace('.html', '')] = fs.readFileSync(filePath, 'utf8');
            console.log(`   ✅ Loaded ${file}`);
        } else {
            console.warn(`   ⚠️ Template not found: ${file}`);
        }
    }
    
    return templates;
}

function loadComponents() {
    console.log('\n🧩 Loading components...');
    
    const components = {};
    const componentFiles = ['header.html', 'footer.html', 'nav.html'];
    
    for (const file of componentFiles) {
        const filePath = path.join(CONFIG.componentsDir, file);
        if (fs.existsSync(filePath)) {
            components[file.replace('.html', '')] = fs.readFileSync(filePath, 'utf8');
            console.log(`   ✅ Loaded ${file}`);
        }
    }
    
    // Inject nav into header
    if (components.header && components.nav) {
        components.header = components.header.replace('{{NAV_COMPONENT}}', components.nav);
    }
    
    // Replace year in footer
    if (components.footer) {
        components.footer = components.footer.replace('{{YEAR}}', new Date().getFullYear());
    }
    
    return components;
}

function loadAssets() {
    console.log('\n🎨 Loading assets...');
    
    const assets = {};
    
    const cssPath = path.join(CONFIG.cssDir, 'main.css');
    if (fs.existsSync(cssPath)) {
        assets.css = fs.readFileSync(cssPath, 'utf8');
        console.log('   ✅ Loaded main.css');
    }
    
    const jsPath = path.join(CONFIG.jsDir, 'main.js');
    if (fs.existsSync(jsPath)) {
        assets.js = fs.readFileSync(jsPath, 'utf8');
        console.log('   ✅ Loaded main.js');
    }
    
    return assets;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function slugToPath(slug, link) {
    // Convert WordPress link to file path
    // https://marga.biz/copier-rental/printer-rental/ -> copier-rental/printer-rental/index.html
    
    if (!slug && !link) return 'index.html';
    
    // Handle homepage
    if (slug === '' || slug === 'home' || slug === 'copier-rental' && link === 'https://marga.biz/') {
        return 'index.html';
    }
    
    // Parse path from link
    let urlPath = '';
    if (link) {
        try {
            const url = new URL(link);
            urlPath = url.pathname.replace(/^\/|\/$/g, '');
        } catch {
            urlPath = slug;
        }
    } else {
        urlPath = slug;
    }
    
    if (!urlPath) return 'index.html';
    
    return `${urlPath}/index.html`;
}

function extractH1(content) {
    const h1Match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
        return h1Match[1].replace(/<[^>]+>/g, '').trim();
    }
    return '';
}

function cleanContent(content, urlMap = {}) {
    if (!content) return '';
    
    // Remove WordPress shortcodes
    content = content.replace(/\[.*?\]/g, '');
    
    // Fix image URLs - convert WordPress URLs to Firebase Storage (FLAT structure - no year/month)
    content = content.replace(
        /https?:\/\/marga\.biz\/wp-content\/uploads\/\d{4}\/\d{2}\/([^"'\s>]+)/gi,
        (match, filename) => {
            // Clean filename (remove query strings and size suffixes like -300x300)
            let cleanFilename = filename.split('?')[0];
            // Remove WordPress size suffixes like -300x300, -768x564, etc.
            cleanFilename = cleanFilename.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
            return `https://firebasestorage.googleapis.com/v0/b/sah-spiritual-journal.firebasestorage.app/o/public%2Fwebsite%2F${encodeURIComponent(cleanFilename)}?alt=media`;
        }
    );
    
    // Also handle http:// URLs (same flat structure)
    content = content.replace(
        /http:\/\/marga\.biz\/wp-content\/uploads\/\d{4}\/\d{2}\/([^"'\s>]+)/gi,
        (match, filename) => {
            let cleanFilename = filename.split('?')[0];
            cleanFilename = cleanFilename.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
            return `https://firebasestorage.googleapis.com/v0/b/sah-spiritual-journal.firebasestorage.app/o/public%2Fwebsite%2F${encodeURIComponent(cleanFilename)}?alt=media`;
        }
    );
    
    // Known broken URL mappings (content has wrong paths)
    const brokenUrlFixes = {
        "3d-printers-for-rent": "/printer-rental/3d-printers-for-rent/",
        "copier-rental/color-copier-rental": "/blogs/color-copier-rental/",
        "copier-rental/short-term-copier-rental": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/short-term-copier-rental/",
        "dot-matrix-printers-for-rent": "/printer-rental/types-of-printers-for-rent/dot-matrix-printers-for-rent/",
        "portable-printers-for-rent": "/printer-rental/types-of-printers-for-rent/portable-printers-for-rent/",
        "copier-technology-and-features-faqs": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-technology-and-features-faqs/",
        "duration-of-copier-rentals": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/duration-of-copier-rentals/",
        "impact-of-digital-transformation": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/impact-of-digital-transformation/",
        "maintenance-and-support-faqs": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/maintenance-and-support-faqs/",
        "overview-of-copier-rental-market-trends": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/overview-of-copier-rental-market-trends/",
        "printer-rental-contracts": "/copier-rental/printer-rental-contracts/",
        "printer-rental-vs-purchase": "/printer-rental/printer-rental-vs-purchase/",
        "regulatory-impact-on-copier-rentals": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/regulatory-impact-on-copier-rentals/",
        "shifts-in-consumer-preferences": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/shifts-in-consumer-preferences/",
        "technological-advancements-in-copiers": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/technological-advancements-in-copiers/",
        "terms-of-service": "/terms-of-service/",
        "color-copier-rental": "/blogs/color-copier-rental/",
        "short-term-copier-rental": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/short-term-copier-rental/",
        "access-to-latest-technology": "/printer-rental/access-to-latest-technology/",
        "adoption-of-cloud-technology-in-copier-rentals": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/adoption-of-cloud-technology-in-copier-rentals/",
        "advanced-maintenance-technologies": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/maintenance-and-support/advanced-maintenance-technologies/",
        "advanced-technology-in-high-volume-copiers": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/high-volume-copier-rental/advanced-technology-in-high-volume-copiers/",
        "case-studies-effective-copier-maintenance": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/maintenance-and-support/case-studies-effective-copier-maintenance/",
        "case-studies-on-high-volume-copier-rentals": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/high-volume-copier-rental/case-studies-on-high-volume-copier-rentals/",
        "challenges-facing-the-copier-rental-market": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/challenges-facing-the-copier-rental-market/",
        "choosing-the-right-copier-rental": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/choosing-the-right-copier-rental/",
        "color-copier-rental-costs": "/blogs/color-copier-rental/color-copier-rental-costs/",
        "consumer-education-and-engagement": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/consumer-education-and-engagement/",
        "copier-rental-insurance-options": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-overview/copier-rental-insurance-options/",
        "costs-involved-in-copier-rentals": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/costs-involved-in-copier-rentals/",
        "customization-and-personalization-trends": "/printer-rental/future-trends-in-printer-rentals/customization-and-personalization-trends/",
        "demand-for-multifunction-copiers": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/demand-for-multifunction-copiers/",
        "emerging-technologies-in-printer-rentals": "/printer-rental/future-trends-in-printer-rentals/emerging-technologies-in-printer-rentals/",
        "enhancing-security-with-rented-copiers": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-overview/enhancing-security-with-rented-copiers/",
        "feedback-and-improvement-for-copier-rentals": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/high-volume-copier-rental/feedback-and-improvement-for-copier-rentals/",
        "growth-of-wireless-printer-rentals": "/printer-rental/future-trends-in-printer-rentals/growth-of-wireless-printer-rentals/",
        "impact-of-copier-rental-on-workflow": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-overview/impact-of-copier-rental-on-workflow/",
        "innovations-in-copier-rental-services": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/innovations-in-copier-rental-services/",
        "maintenance-and-support": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/maintenance-and-support/",
        "pricing-strategies-in-copier-rentals": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/pricing-strategies-in-copier-rentals/",
        "reducing-costs-with-high-volume-copier-rentals": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/high-volume-copier-rental/reducing-costs-with-high-volume-copier-rentals/",
        "role-of-maintenance-in-copier-lifecycle": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/maintenance-and-support/role-of-maintenance-in-copier-lifecycle/",
        "security-features-for-color-copiers": "/blogs/color-copier-rental/security-features-for-color-copiers/",
        "sustainability-practices-in-copier-rental": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-overview/sustainability-practices-in-copier-rental/",
        "sustainability-trends-in-copier-rentals": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/sustainability-trends-in-copier-rentals/",
        "sustainable-maintenance-practices": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/maintenance-and-support/sustainable-maintenance-practices/",
        "the-rise-of-eco-friendly-printer-rentals": "/printer-rental/future-trends-in-printer-rentals/the-rise-of-eco-friendly-printer-rentals/",
        "the-role-of-data-analytics-in-copier-rentals": "/copier-rental/printer-and-copier-leasing-smart-solution-for-businesses/copier-rental-market-trends/the-role-of-data-analytics-in-copier-rentals/"
    };
    
    // Fix internal links - convert to relative and fix broken short URLs
    content = content.replace(/href="https?:\/\/marga\.biz\/([^"]*?)"/gi, (match, path) => {
        // Remove trailing slash for comparison
        const cleanPath = path.replace(/\/$/, '');
        
        // First check hardcoded broken URL fixes
        if (brokenUrlFixes[cleanPath]) {
            return `href="${brokenUrlFixes[cleanPath]}"`;
        }
        
        // Extract the slug (last part of the path)
        const parts = cleanPath.split('/');
        const slug = parts[parts.length - 1] || parts[parts.length - 2];
        
        // Check hardcoded fixes by slug
        if (slug && brokenUrlFixes[slug]) {
            return `href="${brokenUrlFixes[slug]}"`;
        }
        
        // Check if this slug exists in our URL map with a different path
        if (slug && urlMap[slug]) {
            const correctPath = urlMap[slug];
            // Only replace if paths are different (broken link)
            if (correctPath !== '/' + path && correctPath !== '/' + cleanPath + '/') {
                return `href="${correctPath}"`;
            }
        }
        
        // Default: just make it relative
        return `href="/${path}"`;
    });
    
    // Clean up empty paragraphs
    content = content.replace(/<p>\s*<\/p>/gi, '');
    content = content.replace(/<p>&nbsp;<\/p>/gi, '');
    
    // Remove WordPress comments
    content = content.replace(/<!--.*?-->/gs, '');
    
    return content;
}

function generateBreadcrumbs(link) {
    if (!link) return '';
    
    try {
        const url = new URL(link);
        const parts = url.pathname.split('/').filter(p => p);
        
        if (parts.length === 0) return '';
        
        let breadcrumbs = '';
        let currentPath = '';
        
        for (let i = 0; i < parts.length; i++) {
            currentPath += '/' + parts[i];
            const name = parts[i].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const position = i + 2;
            
            if (i === parts.length - 1) {
                // Last item - no link
                breadcrumbs += `
                <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                    <span itemprop="name">${name}</span>
                    <meta itemprop="position" content="${position}">
                </li>`;
            } else {
                breadcrumbs += `
                <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                    <a itemprop="item" href="${currentPath}/"><span itemprop="name">${name}</span></a>
                    <meta itemprop="position" content="${position}">
                </li>`;
            }
        }
        
        return breadcrumbs;
    } catch {
        return '';
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch {
        return dateString;
    }
}

function formatDateISO(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    } catch {
        return '';
    }
}

// ============================================
// STRUCTURED DATA GENERATOR
// ============================================

function generateStructuredData(page, type = 'page') {
    const isHomepage = page.link === 'https://marga.biz/' || page.slug === 'copier-rental';
    
    const baseData = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": "https://marga.biz/#website",
                "url": "https://marga.biz/",
                "name": "Marga Enterprises",
                "description": "Professional Copier & Printer Rental in Manila, Philippines",
                "inLanguage": "en-US"
            },
            {
                "@type": "Organization",
                "@id": "https://marga.biz/#organization",
                "name": "Marga Enterprises",
                "url": "https://marga.biz/",
                "logo": {
                    "@type": "ImageObject",
                    "url": CONFIG.firebaseStorage + "marga-logo.png?alt=media"
                },
                "contactPoint": {
                    "@type": "ContactPoint",
                    "telephone": "+63-917-164-2540",
                    "contactType": "Customer Service",
                    "areaServed": "PH",
                    "availableLanguage": ["en", "tl"]
                },
                "sameAs": [
                    "https://www.facebook.com/margaenterprises",
                    "https://www.youtube.com/@MargaEnterprises24"
                ]
            }
        ]
    };
    
    // Add page-specific data
    if (type === 'post') {
        baseData["@graph"].push({
            "@type": "BlogPosting",
            "headline": page.seo?.title || page.title,
            "description": page.seo?.metaDescription || '',
            "datePublished": page.publishedDate,
            "author": {
                "@type": "Organization",
                "name": "Marga Enterprises"
            },
            "publisher": {
                "@type": "Organization",
                "name": "Marga Enterprises",
                "@id": "https://marga.biz/#organization"
            }
        });
    } else {
        baseData["@graph"].push({
            "@type": "WebPage",
            "@id": page.link || CONFIG.baseUrl,
            "url": page.link || CONFIG.baseUrl,
            "name": page.seo?.title || page.title,
            "description": page.seo?.metaDescription || '',
            "inLanguage": "en-US",
            "isPartOf": {"@id": "https://marga.biz/#website"}
        });
    }
    
    // Add LocalBusiness for homepage
    if (isHomepage) {
        baseData["@graph"].push({
            "@type": "LocalBusiness",
            "name": "Marga Enterprises",
            "@id": "https://marga.biz/#localbusiness",
            "url": "https://marga.biz",
            "telephone": "+63-917-164-2540",
            "priceRange": "₱₱",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Taytay",
                "addressRegion": "Rizal",
                "addressCountry": "PH"
            },
            "areaServed": ["Metro Manila", "Cavite", "Laguna", "Rizal", "Bulacan"]
        });
    }
    
    return JSON.stringify(baseData, null, 2);
}

// ============================================
// PAGE GENERATOR
// ============================================

function generatePage(page, templates, components, isHomepage = false, urlMap = {}) {
    const seo = page.seo || {};
    
    // Extract data
    const title = seo.title || page.title || 'Marga Enterprises';
    const metaDesc = seo.metaDescription || 'Professional copier and printer rental services in Manila, Philippines.';
    const focusKeyword = seo.focusKeyword || 'copier rental';
    const canonical = page.link || CONFIG.baseUrl;
    const ogTitle = seo.ogTitle || title;
    const ogDesc = seo.ogDescription || metaDesc;
    const h1Title = extractH1(page.content) || page.title;
    
    // Clean content
    let content = cleanContent(page.content, urlMap);
    
    // Remove H1 from content (we add it in template)
    content = content.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');
    
    // Build page from template
    let html = templates.base;
    
    // Replace SEO placeholders
    html = html.replace(/\{\{SEO_TITLE\}\}/g, escapeHtml(title));
    html = html.replace(/\{\{META_DESCRIPTION\}\}/g, escapeHtml(metaDesc));
    html = html.replace(/\{\{KEYWORDS\}\}/g, escapeHtml(focusKeyword + ', printer rental, manila, philippines'));
    html = html.replace(/\{\{CANONICAL_URL\}\}/g, canonical);
    html = html.replace(/\{\{OG_TYPE\}\}/g, 'website');
    html = html.replace(/\{\{OG_TITLE\}\}/g, escapeHtml(ogTitle));
    html = html.replace(/\{\{OG_DESCRIPTION\}\}/g, escapeHtml(ogDesc));
    html = html.replace(/\{\{OG_IMAGE\}\}/g, seo.ogImage || CONFIG.defaultOgImage);
    
    // Replace components
    html = html.replace(/\{\{HEADER_COMPONENT\}\}/g, components.header);
    html = html.replace(/\{\{FOOTER_COMPONENT\}\}/g, components.footer);
    
    // Generate structured data
    html = html.replace(/\{\{STRUCTURED_DATA\}\}/g, generateStructuredData(page, 'page'));
    
    // Build main content
    let mainContent = '';
    
    if (isHomepage) {
        // Homepage with hero
        mainContent = `
        <section class="hero">
            <div class="container">
                <h1>${escapeHtml(h1Title)}</h1>
                <p class="lead">Top copier rental Philippines. Quality printers & copiers from ₱1,250/month. Full support included.</p>
                <div class="cta-buttons">
                    <a href="/contact/" class="btn btn-primary">Get Instant Quote</a>
                    <a href="tel:09171642540" class="btn btn-secondary">Call 09171642540</a>
                </div>
            </div>
        </section>
        <article class="page-content">
            <div class="container">
                <div class="content-wrapper">
                    ${content}
                </div>
            </div>
        </article>`;
    } else {
        // Regular page with breadcrumbs
        mainContent = `
        <section class="page-header">
            <div class="container">
                <nav class="breadcrumb" aria-label="Breadcrumb">
                    <ol itemscope itemtype="https://schema.org/BreadcrumbList">
                        <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                            <a itemprop="item" href="/"><span itemprop="name">Home</span></a>
                            <meta itemprop="position" content="1">
                        </li>
                        ${generateBreadcrumbs(page.link)}
                    </ol>
                </nav>
                <h1>${escapeHtml(h1Title)}</h1>
            </div>
        </section>
        <article class="page-content">
            <div class="container">
                <div class="content-wrapper">
                    ${content}
                </div>
            </div>
        </article>
        <section class="cta-section">
            <div class="container">
                <h2>Ready to Get Started?</h2>
                <p>Contact us today for a free quote on copier and printer rental services.</p>
                <div class="cta-buttons">
                    <a href="/contact/" class="btn btn-primary">Get a Quote</a>
                    <a href="tel:09171642540" class="btn btn-outline">Call 09171642540</a>
                </div>
            </div>
        </section>`;
    }
    
    html = html.replace(/\{\{MAIN_CONTENT\}\}/g, mainContent);
    html = html.replace(/\{\{BODY_CLASS\}\}/g, isHomepage ? 'home' : 'page');
    html = html.replace(/\{\{EXTRA_HEAD\}\}/g, '');
    html = html.replace(/\{\{EXTRA_SCRIPTS\}\}/g, '\n    <script src="/js/ga4-events.js" defer></script>');
    
    // Remove unused template conditionals
    html = html.replace(/\{\{#.*?\}\}[\s\S]*?\{\{\/.*?\}\}/g, '');
    html = html.replace(/\{\{\^.*?\}\}[\s\S]*?\{\{\/.*?\}\}/g, '');
    
    return html;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================
// BLOG POST GENERATOR
// ============================================

function generateBlogPost(post, templates, components, allPosts, postIndex, urlMap = {}) {
    const seo = post.seo || {};
    
    const title = seo.title || post.title || 'Blog Post';
    const metaDesc = seo.metaDescription || 'Read this article from Marga Enterprises.';
    const focusKeyword = seo.focusKeyword || 'copier rental';
    const canonical = post.link || `${CONFIG.baseUrl}/blogs/${post.slug}/`;
    const ogTitle = seo.ogTitle || title;
    const ogDesc = seo.ogDescription || metaDesc;
    const h1Title = extractH1(post.content) || post.title;
    
    let content = cleanContent(post.content, urlMap);
    content = content.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');
    
    let html = templates.base;
    
    // SEO replacements
    html = html.replace(/\{\{SEO_TITLE\}\}/g, escapeHtml(title));
    html = html.replace(/\{\{META_DESCRIPTION\}\}/g, escapeHtml(metaDesc));
    html = html.replace(/\{\{KEYWORDS\}\}/g, escapeHtml(focusKeyword + ', printer rental, copier rental'));
    html = html.replace(/\{\{CANONICAL_URL\}\}/g, canonical);
    html = html.replace(/\{\{OG_TYPE\}\}/g, 'article');
    html = html.replace(/\{\{OG_TITLE\}\}/g, escapeHtml(ogTitle));
    html = html.replace(/\{\{OG_DESCRIPTION\}\}/g, escapeHtml(ogDesc));
    html = html.replace(/\{\{OG_IMAGE\}\}/g, seo.ogImage || CONFIG.defaultOgImage);
    
    // Components
    html = html.replace(/\{\{HEADER_COMPONENT\}\}/g, components.header);
    html = html.replace(/\{\{FOOTER_COMPONENT\}\}/g, components.footer);
    html = html.replace(/\{\{STRUCTURED_DATA\}\}/g, generateStructuredData(post, 'post'));
    
    // Build related posts (3 random posts)
    const relatedPosts = allPosts
        .filter((p, i) => i !== postIndex)
        .slice(0, 3)
        .map(p => `<li><a href="/blogs/${p.slug}/">${escapeHtml(p.title)}</a></li>`)
        .join('\n');
    
    // Navigation (prev/next)
    const prevPost = postIndex > 0 ? allPosts[postIndex - 1] : null;
    const nextPost = postIndex < allPosts.length - 1 ? allPosts[postIndex + 1] : null;
    
    let navHtml = '';
    if (prevPost) {
        navHtml += `<a href="/blogs/${prevPost.slug}/" class="nav-prev"><span class="nav-label">Previous</span><span class="nav-title">${escapeHtml(prevPost.title)}</span></a>`;
    }
    if (nextPost) {
        navHtml += `<a href="/blogs/${nextPost.slug}/" class="nav-next"><span class="nav-label">Next</span><span class="nav-title">${escapeHtml(nextPost.title)}</span></a>`;
    }

    // Build main content for blog post
    const mainContent = `
    <article class="blog-post" itemscope itemtype="https://schema.org/BlogPosting">
        <header class="post-header">
            <div class="container">
                <nav class="breadcrumb" aria-label="Breadcrumb">
                    <ol itemscope itemtype="https://schema.org/BreadcrumbList">
                        <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                            <a itemprop="item" href="/"><span itemprop="name">Home</span></a>
                            <meta itemprop="position" content="1">
                        </li>
                        <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                            <a itemprop="item" href="/blogs/"><span itemprop="name">Blog</span></a>
                            <meta itemprop="position" content="2">
                        </li>
                        <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                            <span itemprop="name">${escapeHtml(post.title)}</span>
                            <meta itemprop="position" content="3">
                        </li>
                    </ol>
                </nav>
                <h1 itemprop="headline">${escapeHtml(h1Title)}</h1>
                <div class="post-meta">
                    <time datetime="${formatDateISO(post.publishedDate)}" itemprop="datePublished">${formatDate(post.publishedDate)}</time>
                    <span class="author" itemprop="author" itemscope itemtype="https://schema.org/Organization">
                        <span itemprop="name">Marga Enterprises</span>
                    </span>
                </div>
            </div>
        </header>
        <div class="post-content-wrapper">
            <div class="container">
                <div class="post-content" itemprop="articleBody">
                    ${content}
                </div>
                <aside class="post-sidebar">
                    <div class="sidebar-widget">
                        <h3>Related Articles</h3>
                        <ul class="related-posts">${relatedPosts}</ul>
                    </div>
                    <div class="sidebar-widget cta-widget">
                        <h3>Need a Copier?</h3>
                        <p>Get quality printer & copier rentals from ₱1,250/month</p>
                        <a href="/contact/" class="btn btn-primary">Get Quote</a>
                    </div>
                </aside>
            </div>
        </div>
    </article>
    <nav class="post-navigation">
        <div class="container">${navHtml}</div>
    </nav>`;
    
    html = html.replace(/\{\{MAIN_CONTENT\}\}/g, mainContent);
    html = html.replace(/\{\{BODY_CLASS\}\}/g, 'blog-post-page');
    html = html.replace(/\{\{EXTRA_HEAD\}\}/g, '');
    html = html.replace(/\{\{EXTRA_SCRIPTS\}\}/g, '\n    <script src="/js/ga4-events.js" defer></script>');
    
    // Clean up
    html = html.replace(/\{\{#.*?\}\}[\s\S]*?\{\{\/.*?\}\}/g, '');
    html = html.replace(/\{\{\^.*?\}\}[\s\S]*?\{\{\/.*?\}\}/g, '');
    
    return html;
}

// ============================================
// SITEMAP GENERATOR
// ============================================

function generateSitemap(pages, posts) {
    console.log('\n📍 Generating sitemap.xml...');
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Add homepage
    xml += `  <url>
    <loc>${CONFIG.baseUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>\n`;
    
    // Add all pages
    for (const page of pages) {
        if (page.link === 'https://marga.biz/') continue; // Skip homepage (already added)
        
        const loc = page.link || `${CONFIG.baseUrl}/${page.slug}/`;
        xml += `  <url>
    <loc>${loc}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
    }
    
    // Add all posts
    for (const post of posts) {
        const loc = post.link || `${CONFIG.baseUrl}/blogs/${post.slug}/`;
        xml += `  <url>
    <loc>${loc}</loc>
    <lastmod>${formatDateISO(post.publishedDate)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
    }
    
    xml += '</urlset>';
    
    fs.writeFileSync(path.join(CONFIG.distDir, 'sitemap.xml'), xml);
    console.log(`   ✅ Generated sitemap with ${pages.length + posts.length + 1} URLs`);
}

// ============================================
// ROBOTS.TXT GENERATOR
// ============================================

function generateRobotsTxt() {
    console.log('\n🤖 Generating robots.txt...');
    
    const robots = `# Marga Enterprises - Robots.txt
User-agent: *
Allow: /

# Sitemap
Sitemap: ${CONFIG.baseUrl}/sitemap.xml

# Crawl-delay for politeness
Crawl-delay: 1
`;
    
    fs.writeFileSync(path.join(CONFIG.distDir, 'robots.txt'), robots);
    console.log('   ✅ Generated robots.txt');
}

// ============================================
// BLOG INDEX GENERATOR
// ============================================

function generateBlogIndex(posts, templates, components) {
    console.log('\n📰 Generating blog index...');
    
    let html = templates.base;
    
    // SEO
    html = html.replace(/\{\{SEO_TITLE\}\}/g, 'Blog | Copier & Printer Rental Tips | Marga Enterprises');
    html = html.replace(/\{\{META_DESCRIPTION\}\}/g, 'Read our latest articles about copier rental, printer rental, and office equipment tips for businesses in the Philippines.');
    html = html.replace(/\{\{KEYWORDS\}\}/g, 'copier rental blog, printer rental tips, office equipment, philippines');
    html = html.replace(/\{\{CANONICAL_URL\}\}/g, `${CONFIG.baseUrl}/blogs/`);
    html = html.replace(/\{\{OG_TYPE\}\}/g, 'website');
    html = html.replace(/\{\{OG_TITLE\}\}/g, 'Blog | Marga Enterprises');
    html = html.replace(/\{\{OG_DESCRIPTION\}\}/g, 'Expert tips and guides on copier and printer rental for Philippine businesses.');
    html = html.replace(/\{\{OG_IMAGE\}\}/g, CONFIG.defaultOgImage);
    
    html = html.replace(/\{\{HEADER_COMPONENT\}\}/g, components.header);
    html = html.replace(/\{\{FOOTER_COMPONENT\}\}/g, components.footer);
    html = html.replace(/\{\{STRUCTURED_DATA\}\}/g, JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": "Marga Enterprises Blog",
        "url": `${CONFIG.baseUrl}/blogs/`
    }));
    
    // Generate post list
    const postList = posts.slice(0, 50).map(post => `
        <article class="blog-card">
            <h2><a href="/blogs/${post.slug}/">${escapeHtml(post.title)}</a></h2>
            <time datetime="${formatDateISO(post.publishedDate)}">${formatDate(post.publishedDate)}</time>
            <p>${escapeHtml((post.seo?.metaDescription || '').substring(0, 150))}...</p>
            <a href="/blogs/${post.slug}/" class="read-more">Read More →</a>
        </article>
    `).join('\n');
    
    const mainContent = `
    <section class="page-header">
        <div class="container">
            <h1>Blog</h1>
            <p>Expert tips and guides on copier and printer rental</p>
        </div>
    </section>
    <section class="blog-listing">
        <div class="container">
            <div class="blog-grid">
                ${postList}
            </div>
        </div>
    </section>`;
    
    html = html.replace(/\{\{MAIN_CONTENT\}\}/g, mainContent);
    html = html.replace(/\{\{BODY_CLASS\}\}/g, 'blog-index');
    html = html.replace(/\{\{EXTRA_HEAD\}\}/g, '');
    html = html.replace(/\{\{EXTRA_SCRIPTS\}\}/g, '\n    <script src="/js/ga4-events.js" defer></script>');
    html = html.replace(/\{\{#.*?\}\}[\s\S]*?\{\{\/.*?\}\}/g, '');
    
    const blogDir = path.join(CONFIG.distDir, 'blogs');
    ensureDir(blogDir);
    fs.writeFileSync(path.join(blogDir, 'index.html'), html);
    console.log('   ✅ Generated blog index');
}

// ============================================
// COPY STATIC ASSETS
// ============================================

function copyStaticAssets() {
    console.log('\n📦 Copying static assets...');
    
    // Copy CSS
    const cssDistDir = path.join(CONFIG.distDir, 'css');
    ensureDir(cssDistDir);
    if (fs.existsSync(path.join(CONFIG.cssDir, 'main.css'))) {
        fs.copyFileSync(
            path.join(CONFIG.cssDir, 'main.css'),
            path.join(cssDistDir, 'main.css')
        );
        console.log('   ✅ Copied css/main.css');
    }
    
    // Copy JS
    const jsDistDir = path.join(CONFIG.distDir, 'js');
    ensureDir(jsDistDir);
    if (fs.existsSync(path.join(CONFIG.jsDir, 'main.js'))) {
        fs.copyFileSync(
            path.join(CONFIG.jsDir, 'main.js'),
            path.join(jsDistDir, 'main.js')
        );
        console.log('   ✅ Copied js/main.js');
    }
    
    // Copy GA4 events tracking script
    if (fs.existsSync(path.join(CONFIG.jsDir, 'ga4-events.js'))) {
        fs.copyFileSync(
            path.join(CONFIG.jsDir, 'ga4-events.js'),
            path.join(jsDistDir, 'ga4-events.js')
        );
        console.log('   ✅ Copied js/ga4-events.js');
    }
    
    // Copy other root files
    const rootFiles = ['favicon.ico', 'apple-touch-icon.png', '_redirects', 'netlify.toml', 'marga-logo.png'];
    const rootDir = path.join(__dirname, '..');
    
    for (const file of rootFiles) {
        const srcPath = path.join(rootDir, file);
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, path.join(CONFIG.distDir, file));
            console.log(`   ✅ Copied ${file}`);
        }
    }
    
    // Copy static pages (about, terms-of-service, etc.)
    const staticPagesDir = path.join(rootDir, 'static-pages');
    if (fs.existsSync(staticPagesDir)) {
        const staticPages = fs.readdirSync(staticPagesDir);
        for (const page of staticPages) {
            const srcPageDir = path.join(staticPagesDir, page);
            const destPageDir = path.join(CONFIG.distDir, page);
            if (fs.statSync(srcPageDir).isDirectory()) {
                ensureDir(destPageDir);
                const files = fs.readdirSync(srcPageDir);
                for (const file of files) {
                    fs.copyFileSync(path.join(srcPageDir, file), path.join(destPageDir, file));
                }
                console.log(`   ✅ Copied static page: ${page}`);
            }
        }
    }
    
    // Copy admin folder (Insights dashboard)
    const adminDir = path.join(rootDir, 'admin');
    if (fs.existsSync(adminDir)) {
        copyDirRecursive(adminDir, path.join(CONFIG.distDir, 'admin'));
        console.log('   ✅ Copied admin/ folder');
    }
    
    // Copy admin JS
    const adminJsDir = path.join(CONFIG.jsDir, 'admin');
    if (fs.existsSync(adminJsDir)) {
        copyDirRecursive(adminJsDir, path.join(CONFIG.distDir, 'js', 'admin'));
        console.log('   ✅ Copied js/admin/ folder');
    }
}

// Helper function to copy directory recursively
function copyDirRecursive(src, dest) {
    ensureDir(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    try {
        // Create dist directory
        ensureDir(CONFIG.distDir);
        
        // Load everything
        const wpData = loadData();
        const templates = loadTemplates();
        const components = loadComponents();
        
        const pages = wpData.pages || [];
        const posts = wpData.posts || [];
        
        // Build URL map for fixing internal links
        const urlMap = buildUrlMap(wpData);
        
        // Find homepage
        const homepageIndex = pages.findIndex(p => 
            p.link === 'https://marga.biz/' || 
            (p.slug === 'copier-rental' && p.link?.endsWith('.biz/'))
        );
        
        console.log('\n' + '='.repeat(50));
        console.log('📄 GENERATING PAGES...');
        console.log('='.repeat(50));

        // Generate all pages
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const isHomepage = i === homepageIndex || page.link === 'https://marga.biz/';
            
            try {
                const html = generatePage(page, templates, components, isHomepage, urlMap);
                const filePath = slugToPath(page.slug, page.link);
                const fullPath = path.join(CONFIG.distDir, filePath);
                
                // Create directory structure
                ensureDir(path.dirname(fullPath));
                
                // Write file
                fs.writeFileSync(fullPath, html);
                stats.pages++;
                
                // Progress every 100 pages
                if (stats.pages % 100 === 0) {
                    console.log(`   📄 Generated ${stats.pages}/${pages.length} pages...`);
                }
            } catch (error) {
                stats.errors.push({ type: 'page', slug: page.slug, error: error.message });
            }
        }
        
        console.log(`\n   ✅ Generated ${stats.pages} pages`);
        
        console.log('\n' + '='.repeat(50));
        console.log('📝 GENERATING BLOG POSTS...');
        console.log('='.repeat(50));
        
        // Generate all blog posts
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            
            try {
                const html = generateBlogPost(post, templates, components, posts, i, urlMap);
                const filePath = `blogs/${post.slug}/index.html`;
                const fullPath = path.join(CONFIG.distDir, filePath);
                
                ensureDir(path.dirname(fullPath));
                fs.writeFileSync(fullPath, html);
                stats.posts++;
                
                if (stats.posts % 100 === 0) {
                    console.log(`   📝 Generated ${stats.posts}/${posts.length} posts...`);
                }
            } catch (error) {
                stats.errors.push({ type: 'post', slug: post.slug, error: error.message });
            }
        }
        
        console.log(`\n   ✅ Generated ${stats.posts} blog posts`);
        
        // Generate blog index
        generateBlogIndex(posts, templates, components);
        
        // Generate sitemap
        generateSitemap(pages, posts);
        
        // Generate robots.txt
        generateRobotsTxt();
        
        // Copy static assets
        copyStaticAssets();

        // Summary
        const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);
        
        console.log('\n' + '='.repeat(50));
        console.log('🎉 GENERATION COMPLETE!');
        console.log('='.repeat(50));
        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Pages generated: ${stats.pages}`);
        console.log(`   ✅ Posts generated: ${stats.posts}`);
        console.log(`   ✅ Total files: ${stats.pages + stats.posts + 3}`);
        console.log(`   ⏱️  Duration: ${duration}s`);
        
        if (stats.errors.length > 0) {
            console.log(`\n⚠️  Errors: ${stats.errors.length}`);
            stats.errors.slice(0, 10).forEach(e => {
                console.log(`   - ${e.type}: ${e.slug} - ${e.error}`);
            });
            if (stats.errors.length > 10) {
                console.log(`   ... and ${stats.errors.length - 10} more`);
            }
        }
        
        console.log('\n📁 Output directory: dist/');
        console.log('\n📋 Next steps:');
        console.log('   1. cd dist && python3 -m http.server 8080');
        console.log('   2. Open http://localhost:8080 to test');
        console.log('   3. git add . && git commit -m "Generated static site"');
        console.log('   4. git push (Netlify auto-deploys)\n');
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the generator
main();
