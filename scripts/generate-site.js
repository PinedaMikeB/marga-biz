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

const PRINTER_PAGE_SEO_OVERRIDES = {
    'https://marga.biz/printer-rental/': {
        title: 'Printer Rental Philippines | Printer For Rent & Print All You Can',
        metaDescription: 'Printer rental, printer for rent, and Print All You Can in the Philippines for offices that need delivery, setup, maintenance, and quote-first support.'
    },
    'https://marga.biz/printer-rental/how-much-does-printer-rental-cost/': {
        title: 'Printer Rental Cost Guide | Budgeting for Office Teams',
        metaDescription: 'Use this printer rental cost guide to compare office volume, service inclusions, and setup needs before requesting a quote.'
    },
    'https://marga.biz/printer-rental/how-is-printer-maintenance-handled-in-rentals/': {
        title: 'Rental Printer Maintenance | What Office Teams Should Expect',
        metaDescription: 'Learn how rental printer maintenance is handled, what support is included, and which service questions office teams should ask first.'
    },
    'https://marga.biz/printer-rental/how-do-i-choose-the-right-printer-rental-company/': {
        title: 'Choose the Right Printer Rental Company | Office Guide',
        metaDescription: 'Choose the right printer rental company by comparing support coverage, setup process, scaling options, and quote transparency.'
    },
    'https://marga.biz/printer-rental/comparing-printer-rentals/': {
        title: 'Printer Rental vs Leasing | Cost, Flexibility, Support',
        metaDescription: 'Compare printer rental vs leasing for office teams that need lower upfront cost, better flexibility, and clearer support coverage.'
    },
    'https://marga.biz/printer-rental/cost-savings-printer-rental/': {
        title: 'Printer Rental Cost Savings | Lower Upfront Office Costs',
        metaDescription: 'See how printer rentals reduce upfront office costs by matching the right unit, service package, and print volume to your team.'
    }
};

const PRINTER_PAGE_FAQS = {
    'https://marga.biz/printer-rental/': [
        {
            question: 'What should I send before asking for a printer rental quote?',
            answer: 'Share your office location, monthly print volume, number of users, and whether your team needs mono, color, scanning, or copying so the recommendation is based on real office demand.'
        },
        {
            question: 'Which city pages should Metro Manila offices compare first?',
            answer: 'Start with the Printer Rental Philippines page if your search is broad, then move into the Makati, BGC, Taguig, Manila, Pasig, Quezon City, or Ortigas printer rental pages once the office location is clear.'
        },
        {
            question: 'Does printer rental include setup and maintenance planning?',
            answer: 'Rental quotes should clarify delivery, installation, support coverage, service-call handling, and replacement or upgrade planning so your team can compare more than just the monthly fee.'
        },
        {
            question: 'When should a team compare Print All You Can instead of a standard rental?',
            answer: 'Compare Print All You Can when your office has steady or high-volume recurring print demand and wants to test whether a higher-usage package is more practical than a lighter standard setup.'
        },
        {
            question: 'Can teams use one page to compare Printer Rental, Printer For Rent, and Print All You Can?',
            answer: 'Yes. Use the main Printer Rental hub and the Printer Rental Philippines page to compare standard printer rental, printer-for-rent equipment options, and Print All You Can packages, then move into the local Makati, BGC, Taguig, Manila, Pasig, Quezon City, or Ortigas pages.'
        }
    ],
    'https://marga.biz/printer-rental/how-much-does-printer-rental-cost/': [
        {
            question: 'What usually affects printer rental cost in the Philippines the most?',
            answer: 'Monthly print volume, mono versus color output, number of users, service coverage, and your office location usually affect printer rental cost more than brand preference alone.'
        },
        {
            question: 'Should Makati, BGC, Taguig, or Manila offices expect different rental pricing?',
            answer: 'The location itself is not the only factor, but delivery planning, office access, and support expectations can change how a quote is scoped for Makati, BGC, Taguig, Manila, Pasig, or Quezon City.'
        },
        {
            question: 'Is maintenance usually part of the rental cost?',
            answer: 'Maintenance expectations should be confirmed in the quote because service coverage, consumables, and callout handling can differ by package, unit type, and print volume.'
        },
        {
            question: 'What should we prepare before asking for a printer rental quote?',
            answer: 'Prepare your office location, estimated monthly volume, number of users, preferred contract term, and whether you need mono, color, scanning, or copying so the quote is easier to compare.'
        }
    ],
    'https://marga.biz/printer-rental/how-is-printer-maintenance-handled-in-rentals/': [
        {
            question: 'What does rental printer maintenance usually include?',
            answer: 'Rental printer maintenance usually covers service guidance, troubleshooting, and agreed support steps based on the unit, package, and office workload.'
        },
        {
            question: 'Do office teams still need to handle printer issues alone?',
            answer: 'No. A good rental setup should clarify who to contact, what support is included, and how service issues are handled before downtime spreads.'
        },
        {
            question: 'Why should maintenance terms be reviewed before signing?',
            answer: 'Maintenance terms affect uptime, response expectations, and whether the rental will stay practical as print demand changes.'
        },
        {
            question: 'What should local offices in Makati, BGC, Taguig, or Pasig confirm before installation?',
            answer: 'Confirm delivery access, placement, network setup needs, expected response path, and who inside your team will coordinate service requests after the printer is installed.'
        }
    ],
    'https://marga.biz/printer-rental/how-do-i-choose-the-right-printer-rental-company/': [
        {
            question: 'What should I compare first when choosing a printer rental company?',
            answer: 'Start with support coverage, equipment fit, quote clarity, and whether the provider can match the rental plan to your office workflow.'
        },
        {
            question: 'Why is quote transparency important in printer rental?',
            answer: 'Quote transparency helps teams compare what is actually included, such as setup, maintenance expectations, and upgrade or replacement planning.'
        },
        {
            question: 'Should location matter when choosing a rental company?',
            answer: 'Yes. Office location matters because delivery planning, building access, and practical support expectations should match the area your team works in.'
        },
        {
            question: 'What details should be shared before requesting a recommendation?',
            answer: 'Share your office location, monthly volume, user count, building or floor constraints, and whether you need mono, color, scanning, or copying so the recommendation is more accurate.'
        }
    ],
    'https://marga.biz/printer-rental/comparing-printer-rentals/': [
        {
            question: 'When is printer rental more practical than leasing?',
            answer: 'Printer rental is usually more practical when a team needs lower upfront cost, shorter commitment, or room to adjust the setup as office demand changes.'
        },
        {
            question: 'Why do office teams compare rental support before deciding?',
            answer: 'Support matters because service handling, maintenance coverage, and replacement planning affect whether the printer stays reliable during daily operations.'
        },
        {
            question: 'Does office size affect whether rental or leasing is the better fit?',
            answer: 'Yes. Smaller or changing teams often value flexibility, while larger departments may compare longer-term structure against actual print demand and support needs.'
        },
        {
            question: 'What should be reviewed before choosing rental over leasing?',
            answer: 'Review volume expectations, contract flexibility, service inclusions, early-adjustment options, and how quickly the provider can adjust the equipment if requirements change.'
        }
    ],
    'https://marga.biz/printer-rental/cost-savings-printer-rental/': [
        {
            question: 'How do printer rentals help reduce upfront cost?',
            answer: 'Printer rentals reduce upfront cost by avoiding a full equipment purchase and spreading the setup into a more manageable operating expense.'
        },
        {
            question: 'Why does the right machine size affect savings?',
            answer: 'The right machine size matters because overpaying for unused capacity or under-sizing the printer can create extra cost and workflow problems later.'
        },
        {
            question: 'Do service inclusions affect the total savings?',
            answer: 'Yes. Delivery, setup, maintenance expectations, and support structure all influence the real cost of a printer rental arrangement.'
        },
        {
            question: 'What should a business prepare before comparing rental savings?',
            answer: 'Prepare your expected print volume, office location, number of users, current support pain points, and whether the team needs mono, color, or multifunction capability.'
        }
    ]
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

function getStaticPageUrls() {
    const staticPagesDir = path.join(__dirname, '..', 'static-pages');
    const urls = [];

    if (!fs.existsSync(staticPagesDir)) {
        return urls;
    }

    function walk(dir, relativeDir = '') {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;

            const entryPath = path.join(dir, entry.name);
            const entryRelativePath = path.join(relativeDir, entry.name);

            if (entry.isDirectory()) {
                walk(entryPath, entryRelativePath);
                continue;
            }

            if (entry.name !== 'index.html') continue;
            if (!relativeDir) continue;

            urls.push(`${CONFIG.baseUrl}/${relativeDir.replace(/\\/g, '/')}/`);
        }
    }

    walk(staticPagesDir);
    return urls.sort();
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

    // Restore alt text for a known printer-rental image that often arrives blank from the export.
    content = content.replace(
        /(printer-rental-33\.webp\?alt=media" alt=")"/gi,
        '$1Printer rental Philippines office setup"'
    );
    
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

function getResolvedSeo(page) {
    const override = PRINTER_PAGE_SEO_OVERRIDES[page.link] || {};
    const seo = page.seo || {};
    return {
        ...seo,
        ...override
    };
}

function getPrinterFaqSchema(pageLink) {
    const entries = PRINTER_PAGE_FAQS[pageLink];
    if (!entries || !entries.length) {
        return null;
    }

    return {
        '@type': 'FAQPage',
        mainEntity: entries.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer
            }
        }))
    };
}

function getPrinterFaqSection(pageLink) {
    const entries = PRINTER_PAGE_FAQS[pageLink];
    if (!entries || !entries.length) {
        return '';
    }

    const headingMap = {
        'https://marga.biz/printer-rental/': 'Frequently asked questions about printer rental in the Philippines',
        'https://marga.biz/printer-rental/how-much-does-printer-rental-cost/': 'Frequently asked questions about printer rental cost',
        'https://marga.biz/printer-rental/how-is-printer-maintenance-handled-in-rentals/': 'Frequently asked questions about rental printer maintenance',
        'https://marga.biz/printer-rental/how-do-i-choose-the-right-printer-rental-company/': 'Frequently asked questions about choosing a printer rental company',
        'https://marga.biz/printer-rental/comparing-printer-rentals/': 'Frequently asked questions about printer rental vs leasing',
        'https://marga.biz/printer-rental/cost-savings-printer-rental/': 'Frequently asked questions about printer rental savings'
    };

    const items = entries.map((item) => `
        <article class="faq-item">
            <h3>${escapeHtml(item.question)}</h3>
            <p>${escapeHtml(item.answer)}</p>
        </article>`).join('');

    return `
<section class="faq-section">
    <h2>${escapeHtml(headingMap[pageLink] || 'Frequently asked questions')}</h2>
    <div class="faq-stack">${items}
    </div>
</section>`;
}

// ============================================
// STRUCTURED DATA GENERATOR
// ============================================

function generateStructuredData(page, type = 'page') {
    const isHomepage = page.link === 'https://marga.biz/' || page.slug === 'copier-rental';
    const resolvedSeo = getResolvedSeo(page);
    
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
            "headline": resolvedSeo.title || page.title,
            "description": resolvedSeo.metaDescription || '',
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
            "name": resolvedSeo.title || page.title,
            "description": resolvedSeo.metaDescription || '',
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

    const faqSchema = getPrinterFaqSchema(page.link);
    if (faqSchema) {
        baseData["@graph"].push(faqSchema);
    }
    
    return JSON.stringify(baseData, null, 2);
}

function getPrinterLocationLinkBlock(pageLink) {
    const blocks = {
        'https://marga.biz/printer-rental/printer-for-rent/': `
<section class="quote-panel location-link-section">
    <h2>Need a printer rental page by location?</h2>
    <p>If you are comparing units for a specific office location, review our <a href="/printer-rental/philippines/">Printer Rental Philippines</a>, <a href="/printer-rental/makati/">printer rental Makati</a>, <a href="/printer-rental/ortigas/">printer rental Ortigas</a>, <a href="/printer-rental/pasig/">printer rental Pasig</a>, <a href="/printer-rental/quezon-city/">printer rental Quezon City</a>, <a href="/printer-rental/manila/">printer rental Manila</a>, <a href="/printer-rental/bgc/">printer rental BGC</a>, and <a href="/printer-rental/taguig/">printer rental Taguig</a> pages for local office-fit guidance. Before you approve a quote, use the <a href="/printer-rental/printer-for-rent-philippines-budget-checklist/">Printer For Rent budget checklist</a>, <a href="/printer-rental/printer-rental-manila-office-setup-checklist/">Manila office setup checklist</a>, <a href="/printer-rental/printer-rental-philippines-service-coverage-checklist/">Printer Rental Philippines service coverage checklist</a>, and <a href="/printer-rental/print-all-you-can-volume-planning-guide/">Print All You Can volume planning guide</a>. You can also return to the main <a href="/printer-rental/">Printer Rental</a> hub for broader equipment options.</p>
</section>`,
        'https://marga.biz/printer-rental/printer-for-rent/color-printer-rental-benefits-for-your-business/laser-printer-rental/': `
<section class="quote-panel location-link-section">
    <h2>Where laser printer rental fits best</h2>
    <p>Laser units are especially practical for document-heavy teams. For local guidance, compare <a href="/printer-rental/makati/">printer rental Makati</a>, <a href="/printer-rental/ortigas/">printer rental Ortigas</a>, <a href="/printer-rental/pasig/">printer rental Pasig</a>, <a href="/printer-rental/quezon-city/">printer rental Quezon City</a>, <a href="/printer-rental/manila/">printer rental Manila</a>, <a href="/printer-rental/bgc/">printer rental BGC</a>, and <a href="/printer-rental/taguig/">printer rental Taguig</a>. For the full service overview, browse the main <a href="/printer-rental/">Printer Rental</a> page.</p>
</section>`,
        'https://marga.biz/printer-rental/best-printer-rental-company/inkjet-printer-rental/': `
<section class="quote-panel location-link-section">
    <h2>Looking for color-friendly office setups by location?</h2>
    <p>Inkjet rentals can work well for lighter office color output, admin use, and smaller teams. If you need a Makati-focused option, check <a href="/printer-rental/makati/">printer rental Makati</a>. If your office is in Bonifacio Global City or elsewhere in Taguig, compare <a href="/printer-rental/bgc/">printer rental BGC</a> and <a href="/printer-rental/taguig/">printer rental Taguig</a>. You can compare these against the wider <a href="/printer-rental/">Printer Rental</a> hub before choosing a unit.</p>
</section>`,
        'https://marga.biz/printer-rental/print-all-you-can/': `
<section class="quote-panel location-link-section">
    <h2>High-volume printing by service area</h2>
    <p>Unlimited or high-volume plans are more useful when the printer setup matches your actual office demand. Start with <a href="/printer-rental/philippines/">Printer Rental Philippines</a> if the search is broad, then move into <a href="/printer-rental/makati/">printer rental Makati</a> for established office districts, <a href="/printer-rental/bgc/">printer rental BGC</a> for Bonifacio Global City teams, and <a href="/printer-rental/manila/">Printer Rental Manila</a> or <a href="/printer-rental/taguig/">Printer Rental Taguig</a> for wider city-level demand. Use the <a href="/printer-rental/print-all-you-can-volume-planning-guide/">Print All You Can volume planning guide</a>, <a href="/printer-rental/print-all-you-can-philippines-office-package-comparison/">Print All You Can office package comparison</a>, <a href="/blogs/print-all-you-can-office-package-vs-print-shop/">Print All You Can office package vs print shop</a>, and the <a href="/blogs/print-all-you-can-commercial-intent-cleanup/">Print All You Can commercial intent cleanup</a> before requesting a quote. You can also review all printer categories from the <a href="/printer-rental/">Printer Rental</a> mother page.</p>
</section>`,
        'https://marga.biz/printer-rental/best-printer-rental-company/': `
<section class="quote-panel location-link-section">
    <h2>Comparing the best printer rental option by area</h2>
    <p>The best printer rental company for your team should also understand your office location and workflow. Compare our dedicated pages for <a href="/printer-rental/makati/">Makati</a>, <a href="/printer-rental/ortigas/">Ortigas</a>, <a href="/printer-rental/pasig/">Pasig</a>, <a href="/printer-rental/quezon-city/">Quezon City</a>, <a href="/printer-rental/manila/">Manila</a>, and <a href="/printer-rental/bgc/">BGC</a> before returning to the broader <a href="/printer-rental/">Printer Rental</a> parent service.</p>
</section>`,
        'https://marga.biz/printer-rental/types-of-printers-for-rent/office-printers-for-rent/': `
<section class="quote-panel location-link-section">
    <h2>Office printer rental by business district</h2>
    <p>If your team is looking for a practical office printer rental matched to where the staff actually works, compare <a href="/printer-rental/makati/">printer rental Makati</a> for established Makati offices and <a href="/printer-rental/bgc/">printer rental BGC</a> or <a href="/printer-rental/taguig/">printer rental Taguig</a> for Taguig-based teams. You can also return to the main <a href="/printer-rental/">Printer Rental</a> hub for the wider service overview.</p>
</section>`,
        'https://marga.biz/printer-rental/types-of-printers-for-rent/laser-printers-for-rent/': `
<section class="quote-panel location-link-section">
    <h2>Laser printer rental by location</h2>
    <p>Document-heavy laser setups become more useful when they match your office location, print load, and support needs. For Makati office districts, visit <a href="/printer-rental/makati/">printer rental Makati</a>. For Bonifacio Global City and Taguig teams, review <a href="/printer-rental/bgc/">printer rental BGC</a> and <a href="/printer-rental/taguig/">printer rental Taguig</a>. You can compare both against the parent <a href="/printer-rental/">Printer Rental</a> page.</p>
</section>`,
        'https://marga.biz/printer-rental/types-of-printers-for-rent/multifunction-printers-for-rent/': `
<section class="quote-panel location-link-section">
    <h2>Multifunction printer rental by area</h2>
    <p>A multifunction printer rental works best when scanning, copying, and printing needs are scoped to the office environment. If your users are in Makati, compare <a href="/printer-rental/makati/">printer rental Makati</a>. If your team is in Bonifacio Global City or elsewhere in Taguig, compare <a href="/printer-rental/bgc/">printer rental BGC</a> and <a href="/printer-rental/taguig/">printer rental Taguig</a>. For the broader category overview, return to <a href="/printer-rental/">Printer Rental</a>.</p>
</section>`,
        'https://marga.biz/printer-rental/cost-effective-printer-rentals-for-startups/': `
<section class="quote-panel location-link-section">
    <h2>Startup printer rental by location</h2>
    <p>If your startup team needs a practical rental plan tied to office location and growth stage, compare <a href="/printer-rental/bgc/">printer rental BGC</a> or <a href="/printer-rental/taguig/">printer rental Taguig</a> for Taguig teams and <a href="/printer-rental/makati/">printer rental Makati</a> for established Makati office districts. For the wider service view, use the main <a href="/printer-rental/">Printer Rental</a> page.</p>
</section>`,
        'https://marga.biz/printer-rental/how-much-does-printer-rental-cost/': `
<section class="quote-panel location-link-section">
    <h2>Use cost estimates that match your office setup</h2>
    <p>A realistic printer rental cost estimate starts with office location, print volume, number of users, and whether your team needs mono, color, or multifunction use. Compare <a href="/printer-rental/makati/">printer rental Makati</a>, <a href="/printer-rental/bgc/">printer rental BGC</a>, and <a href="/printer-rental/taguig/">printer rental Taguig</a> if you want city-specific guidance before requesting a quote from the main <a href="/printer-rental/">Printer Rental</a> hub.</p>
</section>`,
        'https://marga.biz/printer-rental/how-is-printer-maintenance-handled-in-rentals/': `
<section class="quote-panel location-link-section">
    <h2>Check maintenance expectations before you approve the rental</h2>
    <p>Printer maintenance becomes easier to compare when the quote clearly explains setup, troubleshooting, service-call handling, and replacement planning. Use our <a href="/printer-rental/makati/">Makati</a>, <a href="/printer-rental/bgc/">BGC</a>, and <a href="/printer-rental/taguig/">Taguig</a> service pages to see how office requirements can affect the support conversation before you contact us.</p>
</section>`,
        'https://marga.biz/printer-rental/how-do-i-choose-the-right-printer-rental-company/': `
<section class="quote-panel location-link-section">
    <h2>Compare printer rental providers using office-fit criteria</h2>
    <p>When choosing a printer rental company, compare quote clarity, office-fit recommendations, maintenance expectations, and how the provider handles scaling. Review our <a href="/printer-rental/makati/">Makati</a>, <a href="/printer-rental/bgc/">BGC</a>, and <a href="/printer-rental/taguig/">Taguig</a> pages to see how printer rental decisions can change by location and workflow.</p>
</section>`,
        'https://marga.biz/printer-rental/comparing-printer-rentals/': `
<section class="quote-panel location-link-section">
    <h2>Compare rental flexibility against real office demand</h2>
    <p>If your office is comparing rental against leasing or outright purchase, start with the print load and support needs that actually affect day-to-day operations. The <a href="/printer-rental/">Printer Rental</a> hub plus our <a href="/printer-rental/makati/">Makati</a>, <a href="/printer-rental/bgc/">BGC</a>, and <a href="/printer-rental/taguig/">Taguig</a> pages make it easier to compare setup options by office environment.</p>
</section>`,
        'https://marga.biz/printer-rental/cost-savings-printer-rental/': `
<section class="quote-panel location-link-section">
    <h2>Cost savings come from matching the unit to the office</h2>
    <p>Printer rental savings improve when the unit, support package, and print volume match how the team actually works. Use our <a href="/printer-rental/makati/">Makati</a>, <a href="/printer-rental/bgc/">BGC</a>, and <a href="/printer-rental/taguig/">Taguig</a> pages to compare office-fit setups before you ask for a quote from the main <a href="/printer-rental/">Printer Rental</a> page.</p>
</section>`
    };

    return blocks[pageLink] || '';
}

// ============================================
// PAGE GENERATOR
// ============================================

function generatePage(page, templates, components, isHomepage = false, urlMap = {}) {
    const seo = getResolvedSeo(page);
    
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

    if (page.link === 'https://marga.biz/printer-rental/') {
        content += `
    <section class="service-areas-section">
        <h2>Printer Rental Service Areas in Metro Manila</h2>
        <p>Need a printer rental provider that understands your office location, delivery requirements, support expectations, and print volume? Use the city pages below to send stronger local relevance into the right service page and compare what the quote should include before you contact us.</p>
        <p>If you are specifically searching for <a href="/printer-rental/philippines/">Printer Rental Philippines</a>, <a href="/printer-rental/makati/">printer rental in Makati</a>, <a href="/printer-rental/ortigas/">printer rental in Ortigas</a>, <a href="/printer-rental/pasig/">printer rental in Pasig</a>, <a href="/printer-rental/quezon-city/">printer rental in Quezon City</a>, <a href="/printer-rental/manila/">printer rental in Manila</a>, <a href="/printer-rental/bgc/">printer rental in BGC</a>, or <a href="/printer-rental/taguig/">printer rental in Taguig</a>, use these pages to compare local office fit, service coverage, and printer types before requesting a quote. For setup-level guidance, pair those pages with the <a href="/printer-rental/how-to-choose-printer-rental-makati/">Makati</a>, <a href="/printer-rental/how-to-choose-printer-rental-pasig/">Pasig</a>, <a href="/printer-rental/how-to-choose-printer-rental-quezon-city/">Quezon City</a>, <a href="/printer-rental/how-to-choose-printer-rental-taguig/">Taguig</a>, <a href="/printer-rental/printer-rental-manila-office-setup-checklist/">Manila office setup checklist</a>, <a href="/printer-rental/printer-rental-taguig-volume-planning/">Taguig volume planning</a>, <a href="/printer-rental/printer-rental-taguig-building-access-checklist/">Taguig building access checklist</a>, <a href="/printer-rental/how-to-plan-print-all-you-can-for-bgc-teams/">BGC Print All You Can planning</a>, and <a href="/printer-rental/printer-rental-makati-vs-bgc-office-setup/">Makati vs BGC setup</a> guides.</p>
        <p>For quote-comparison support, use the <a href="/printer-rental/printer-for-rent-makati-procurement-checklist/">Makati Printer For Rent procurement checklist</a>, <a href="/printer-rental/printer-for-rent-philippines-budget-checklist/">Printer For Rent budget checklist</a>, <a href="/printer-rental/printer-rental-bgc-hidden-fees-checklist/">BGC hidden-fees checklist</a>, <a href="/printer-rental/printer-rental-philippines-service-coverage-checklist/">Printer Rental Philippines service coverage checklist</a>, <a href="/printer-rental/printer-rental-philippines-multi-branch-rollout-checklist/">multi-branch rollout checklist</a>, <a href="/printer-rental/print-all-you-can-volume-planning-guide/">Print All You Can volume planning guide</a>, and <a href="/printer-rental/print-all-you-can-vs-standard-printer-rental/">Print All You Can vs standard rental guide</a>.</p>
    <div class="service-area-grid">
        <a class="service-area-card" href="/printer-rental/philippines/">
            <span class="service-area-label">Philippines</span>
            <strong>Printer Rental Philippines</strong>
            <span>For broad national-intent searches that still need city-fit routing before quote approval.</span>
        </a>
        <a class="service-area-card" href="/printer-rental/makati/">
            <span class="service-area-label">Makati</span>
            <strong>Printer Rental Makati</strong>
            <span>For Ayala, Legazpi, Salcedo, Rockwell, Chino Roces, and surrounding Makati offices.</span>
        </a>
        <a class="service-area-card" href="/printer-rental/ortigas/">
            <span class="service-area-label">Ortigas</span>
            <strong>Printer Rental Ortigas</strong>
            <span>For Ortigas Center, ADB Avenue, Emerald Avenue, Julia Vargas, and nearby office towers.</span>
        </a>
        <a class="service-area-card" href="/printer-rental/pasig/">
            <span class="service-area-label">Pasig</span>
            <strong>Printer Rental Pasig</strong>
            <span>For Kapitolyo, Bridgetowne, Tiendesitas, Arcovia, Rosario, and surrounding Pasig offices.</span>
        </a>
        <a class="service-area-card" href="/printer-rental/quezon-city/">
            <span class="service-area-label">Quezon City</span>
            <strong>Printer Rental Quezon City</strong>
            <span>For Cubao, Eastwood, Timog, Tomas Morato, Vertis North, and nearby QC offices.</span>
        </a>
        <a class="service-area-card" href="/printer-rental/manila/">
            <span class="service-area-label">Manila</span>
            <strong>Printer Rental Manila</strong>
            <span>For Binondo, Ermita, Malate, Intramuros, Sampaloc, and surrounding Manila offices.</span>
        </a>
        <a class="service-area-card" href="/printer-rental/bgc/">
            <span class="service-area-label">BGC</span>
            <strong>Printer Rental BGC</strong>
            <span>For Bonifacio Global City, Taguig office towers, startup teams, clinics, and commercial spaces.</span>
        </a>
        <a class="service-area-card" href="/printer-rental/taguig/">
            <span class="service-area-label">Taguig</span>
            <strong>Printer Rental Taguig</strong>
            <span>For BGC, McKinley Hill, Arca South, Market! Market!, and wider Taguig office locations.</span>
        </a>
    </div>
</section>
<section class="service-areas-section">
    <h2>Related Copier Location Pages</h2>
    <p>If shared copying and scanning are more important than printer-only planning, compare <a href="/copier-rental/bgc/">Copier Rental BGC</a>, <a href="/copier-rental/makati/">Copier Rental Makati</a>, <a href="/copier-rental/manila/">Copier Rental Manila</a>, <a href="/copier-rental/taguig/">Copier Rental Taguig</a>, <a href="/copier-rental/pasig/">Copier Rental Pasig</a>, <a href="/copier-rental/ortigas/">Copier Rental Ortigas</a>, and <a href="/copier-rental/quezon-city/">Copier Rental Quezon City</a> for city-specific quote guidance and office-fit details.</p>
</section>
<section class="quote-panel">
    <h2>What serious office buyers compare before approving a printer rental</h2>
    <p>Before you approve a quote, compare what is included: delivery planning, installation scope, maintenance expectations, service-call handling, consumable assumptions, and whether the printer setup can scale if your workload changes. That is often the difference between a practical rental plan and a cheap quote that creates more downtime later.</p>
</section>
<section class="quote-panel">
    <h2>What to prepare before requesting a quote</h2>
    <p>Send your office location, estimated monthly print volume, number of users, service timeline, and whether you need mono, color, scanning, or copying. If the query is still broad, start with <a href="/printer-rental/philippines/">Printer Rental Philippines</a>. If you already know your service area, compare the dedicated <a href="/printer-rental/makati/">Makati</a>, <a href="/printer-rental/bgc/">BGC</a>, <a href="/printer-rental/taguig/">Taguig</a>, and <a href="/printer-rental/manila/">Manila</a> pages plus the <a href="/printer-rental/how-much-does-printer-rental-cost/">printer rental cost guide</a> before you contact us.</p>
</section>`;
    }

    content += getPrinterLocationLinkBlock(page.link);
    content += getPrinterFaqSection(page.link);
    
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

    // Add static pages
    for (const loc of getStaticPageUrls()) {
        xml += `  <url>
    <loc>${loc}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
    }
    
    xml += '</urlset>';
    
    fs.writeFileSync(path.join(CONFIG.distDir, 'sitemap.xml'), xml);
    console.log(`   ✅ Generated sitemap with ${pages.length + posts.length + 1 + getStaticPageUrls().length} URLs`);
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
        copyDirRecursive(staticPagesDir, CONFIG.distDir);
        console.log('   ✅ Copied static-pages/ recursively');
    }

    // Copy SEO monitor viewer app
    const automationViewerDir = [
        path.join(rootDir, 'automations', 'seo-monitor'),
        path.join(rootDir, 'automations', 'SEO-monitor')
    ].find(fs.existsSync);
    if (automationViewerDir) {
        copyDirRecursive(automationViewerDir, path.join(CONFIG.distDir, 'automations', 'seo-monitor'));
        console.log('   ✅ Copied automations/seo-monitor viewer');
    }

    // Copy shared image assets
    const imagesDir = path.join(rootDir, 'images');
    if (fs.existsSync(imagesDir)) {
        copyDirRecursive(imagesDir, path.join(CONFIG.distDir, 'images'));
        console.log('   ✅ Copied images/ folder');
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
        if (entry.name.startsWith('.')) continue;

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
