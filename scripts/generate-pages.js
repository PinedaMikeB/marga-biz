/**
 * Marga Website Static Site Generator
 * 
 * Generates static HTML pages from WordPress export data
 * Preserves all SEO metadata to maintain #2 Google ranking
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Marga Static Site Generator\n');

// Load WordPress data
const wpDataPath = path.join(__dirname, '../data/wordpress-data.json');
const liveDataPath = path.join(__dirname, '../data/live-site-data.json');

if (!fs.existsSync(wpDataPath)) {
    console.error('❌ WordPress data not found!');
    console.log('Please copy marga-parsed-data.json to data/wordpress-data.json');
    process.exit(1);
}

console.log('📁 Loading WordPress data...');
const wpData = JSON.parse(fs.readFileSync(wpDataPath, 'utf8'));

let liveData = null;
if (fs.existsSync(liveDataPath)) {
    console.log('📁 Loading live site data...');
    liveData = JSON.parse(fs.readFileSync(liveDataPath, 'utf8'));
}

console.log(`✅ Loaded ${wpData.pages.length} pages\n`);

// Find homepage
const homepage = wpData.pages.find(p => 
    p.slug === '' || 
    p.slug === 'home' ||
    p.slug === 'copier-rental' ||
    p.link.endsWith('.biz/') ||
    p.title.toLowerCase().includes('copier rental')
);

if (!homepage) {
    console.error('❌ Could not find homepage!');
    process.exit(1);
}

console.log('🏠 Homepage found:', homepage.title);

// Generate homepage
function generateHomepage() {
    console.log('\n📝 Generating homepage...');
    
    const canonical = liveData?.page?.canonical || 'https://marga.biz/';
    const seoTitle = homepage.seo.title || homepage.title;
    const metaDesc = homepage.seo.metaDescription || '';
    const focusKeyword = homepage.seo.focusKeyword || 'copier rental';
    
    // Use live data for OG tags if available, otherwise WordPress
    const ogTitle = liveData?.page?.ogTitle || homepage.seo.ogTitle || seoTitle;
    const ogDesc = liveData?.page?.ogDescription || homepage.seo.ogDescription || metaDesc;
    const ogImage = liveData?.page?.ogImage || homepage.seo.ogImage || 'https://marga.biz/images/og-image.jpg';
    
    const html = `<!DOCTYPE html>
<html lang="en-US">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- SEO Meta Tags (Preserved from WordPress/Yoast) -->
    <title>${seoTitle}</title>
    <meta name="description" content="${metaDesc}">
    <meta name="keywords" content="${focusKeyword}, printer rental, manila, philippines">
    
    <!-- Canonical URL -->
    <link rel="canonical" href="${canonical}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonical}">
    <meta property="og:title" content="${ogTitle}">
    <meta property="og:description" content="${ogDesc}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:site_name" content="Marga Enterprises - Copier & Printer Rental">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${canonical}">
    <meta name="twitter:title" content="${ogTitle}">
    <meta name="twitter:description" content="${ogDesc}">
    <meta name="twitter:image" content="${ogImage}">
    
    <!-- Favicon -->
    <link rel="icon" href="images/favicon.ico">
    
    <!-- Inline Styles (for local viewing) -->
    <style>
        ${getInlineCSS()}
    </style>
    
    <!-- Structured Data (Schema.org) -->
    <script type="application/ld+json">
    ${generateStructuredData(homepage, liveData)}
    </script>
</head>
<body>
    <!-- Header -->
    <header class="site-header">
        <div class="container">
            <div class="logo">
                <h2 style="color: #0066cc; font-size: 1.8rem;">MARGA</h2>
            </div>
            <nav class="main-nav">
                <ul>
                    <li><a href="index.html">Home</a></li>
                    <li><a href="#services">Services</a></li>
                    <li><a href="#about">About</a></li>
                    <li><a href="#contact">Contact</a></li>
                </ul>
            </nav>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="hero">
        <div class="container">
            <h1>${extractH1(homepage.content) || seoTitle}</h1>
            <p class="lead">Top copier rental Philippines. Quality printers & copiers from ₱1,250/month. Full support included.</p>
            <div class="cta-buttons">
                <a href="/contact/" class="btn btn-primary">Get Instant Quote</a>
                <a href="tel:09171642540" class="btn btn-secondary">Call 09171642540</a>
            </div>
        </div>
    </section>

    <!-- Main Content -->
    <main class="main-content">
        <div class="container">
            ${processContent(homepage.content)}
        </div>
    </main>

    <!-- Footer -->
    <footer class="site-footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-col">
                    <h3>Marga Enterprises</h3>
                    <p>Professional Copier & Printer Rental</p>
                    <p>Serving Metro Manila & Nearby Provinces</p>
                </div>
                <div class="footer-col">
                    <h3>Contact</h3>
                    <p>Phone: 09171642540</p>
                    <p>Email: sales@marga.biz</p>
                    <p>Location: Taytay, Rizal</p>
                </div>
                <div class="footer-col">
                    <h3>Services</h3>
                    <p>Long-term Rental</p>
                    <p>Short-term Rental</p>
                    <p>Event Rental</p>
                    <p>Maintenance & Support</p>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; ${new Date().getFullYear()} Marga Enterprises. All rights reserved.</p>
            </div>
        </div>
    </footer>

    <!-- Inline JavaScript -->
    <script>
        ${getInlineJS()}
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(__dirname, '../index.html'), html);
    console.log('✅ Homepage generated: index.html');
}

// Get inline CSS for standalone HTML
function getInlineCSS() {
    const cssPath = path.join(__dirname, '../css/main.css');
    if (fs.existsSync(cssPath)) {
        return fs.readFileSync(cssPath, 'utf8');
    }
    return '/* CSS file not found */';
}

// Get inline JS for standalone HTML
function getInlineJS() {
    const jsPath = path.join(__dirname, '../js/main.js');
    if (fs.existsSync(jsPath)) {
        return fs.readFileSync(jsPath, 'utf8');
    }
    return '// JS file not found';
}

// Generate structured data
function generateStructuredData(page, liveData) {
    const structuredData = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": "https://marga.biz/",
                "url": "https://marga.biz/",
                "name": page.seo.title || page.title,
                "description": page.seo.metaDescription,
                "inLanguage": "en-US"
            },
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
                    "url": "https://marga.biz/images/marga-logo.png"
                },
                "contactPoint": {
                    "@type": "ContactPoint",
                    "telephone": "+63-917-164-2540",
                    "contactType": "Customer Service",
                    "areaServed": "PH",
                    "availableLanguage": ["en", "tl"]
                },
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "Taytay",
                    "addressRegion": "Rizal",
                    "addressCountry": "PH"
                },
                "sameAs": [
                    "https://www.facebook.com/margaenterprises"
                ]
            },
            {
                "@type": "LocalBusiness",
                "name": "Marga Enterprises",
                "image": "https://marga.biz/images/marga-logo.png",
                "@id": "https://marga.biz",
                "url": "https://marga.biz",
                "telephone": "+63-917-164-2540",
                "priceRange": "₱₱",
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "Taytay",
                    "addressLocality": "Taytay",
                    "addressRegion": "Rizal",
                    "postalCode": "1920",
                    "addressCountry": "PH"
                },
                "geo": {
                    "@type": "GeoCoordinates",
                    "latitude": 14.5574,
                    "longitude": 121.1324
                },
                "openingHoursSpecification": {
                    "@type": "OpeningHoursSpecification",
                    "dayOfWeek": [
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday"
                    ],
                    "opens": "08:00",
                    "closes": "17:00"
                },
                "areaServed": [
                    {
                        "@type": "City",
                        "name": "Manila"
                    },
                    {
                        "@type": "City",
                        "name": "Quezon City"
                    },
                    {
                        "@type": "City",
                        "name": "Makati"
                    },
                    {
                        "@type": "State",
                        "name": "Metro Manila"
                    },
                    {
                        "@type": "State",
                        "name": "Cavite"
                    },
                    {
                        "@type": "State",
                        "name": "Laguna"
                    },
                    {
                        "@type": "State",
                        "name": "Rizal"
                    }
                ]
            }
        ]
    };
    
    return JSON.stringify(structuredData, null, 2);
}

// Extract H1 from content
function extractH1(content) {
    const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match) {
        return h1Match[1].replace(/<[^>]+>/g, '').trim();
    }
    return '';
}

// Process WordPress content
function processContent(content) {
    // Remove WordPress shortcodes
    content = content.replace(/\[.*?\]/g, '');
    
    // Clean up content
    content = content.replace(/<h1[^>]*>.*?<\/h1>/gi, ''); // Remove H1 (already in hero)
    
    // Update image paths
    content = content.replace(/https?:\/\/marga\.biz\/wp-content\/uploads\//g, '/images/');
    content = content.replace(/http:\/\/marga\.biz\/wp-content\/uploads\//g, '/images/');
    
    return content;
}

// Generate sitemap
function generateSitemap() {
    console.log('\n📝 Generating sitemap.xml...');
    
    const urls = [
        {
            loc: 'https://marga.biz/',
            changefreq: 'weekly',
            priority: 1.0
        }
    ];
    
    // Add other pages
    wpData.pages.filter(p => p.slug !== '' && p.slug !== 'home' && p.slug !== 'copier-rental')
        .slice(0, 50) // Top 50 pages for now
        .forEach(page => {
            urls.push({
                loc: `https://marga.biz/${page.slug}/`,
                changefreq: 'monthly',
                priority: 0.8
            });
        });
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    urls.forEach(url => {
        xml += '  <url>\n';
        xml += `    <loc>${url.loc}</loc>\n`;
        xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
        xml += `    <priority>${url.priority}</priority>\n`;
        xml += '  </url>\n';
    });
    
    xml += '</urlset>';
    
    fs.writeFileSync(path.join(__dirname, '../sitemap.xml'), xml);
    console.log('✅ Sitemap generated: sitemap.xml');
}

// Generate robots.txt
function generateRobotsTxt() {
    console.log('📝 Generating robots.txt...');
    
    const robots = `User-agent: *
Allow: /

Sitemap: https://marga.biz/sitemap.xml
`;
    
    fs.writeFileSync(path.join(__dirname, '../robots.txt'), robots);
    console.log('✅ Robots.txt generated\n');
}

// Main execution
try {
    generateHomepage();
    generateSitemap();
    generateRobotsTxt();
    
    console.log('\n🎉 Site generation complete!\n');
    console.log('📋 Next steps:');
    console.log('   1. npm run serve    (test locally)');
    console.log('   2. git add .');
    console.log('   3. git commit -m "Generated static site"');
    console.log('   4. git push');
    console.log('   5. Netlify will auto-deploy\n');
    
} catch (error) {
    console.error('\n❌ Error generating site:', error.message);
    console.error(error.stack);
    process.exit(1);
}
