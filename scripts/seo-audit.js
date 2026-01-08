/**
 * SEO Audit & Site Crawler Tool
 * 
 * This script:
 * 1. Checks all SEO essentials on every page
 * 2. Crawls for broken links
 * 3. Verifies page discoverability
 * 4. Compares sitemap with WordPress
 * 5. Generates comprehensive SEO report
 * 
 * Usage: node scripts/seo-audit.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
    siteUrl: 'https://marga-biz.netlify.app',
    distDir: path.join(__dirname, '../dist'),
    dataDir: path.join(__dirname, '../data'),
    outputDir: path.join(__dirname, '../reports'),
    maxConcurrent: 10,
    timeout: 30000
};

// Stats
const stats = {
    pagesChecked: 0,
    brokenLinks: [],
    seoIssues: [],
    orphanPages: [],
    missingMeta: [],
    goodPages: [],
    startTime: Date.now()
};

console.log('🔍 SEO Audit & Site Crawler Tool\n');
console.log('='.repeat(60));

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}


// ============================================
// SEO CHECKLIST FOR EACH PAGE
// ============================================

function checkPageSEO(filePath, html) {
    const issues = [];
    const warnings = [];
    const passed = [];
    const relativePath = filePath.replace(CONFIG.distDir, '');
    
    // 1. Title Tag
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    if (!titleMatch) {
        issues.push('Missing <title> tag');
    } else if (titleMatch[1].length < 30) {
        warnings.push(`Title too short (${titleMatch[1].length} chars): "${titleMatch[1]}"`);
    } else if (titleMatch[1].length > 60) {
        warnings.push(`Title too long (${titleMatch[1].length} chars)`);
    } else {
        passed.push(`Title OK (${titleMatch[1].length} chars)`);
    }
    
    // 2. Meta Description
    const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
                          html.match(/<meta\s+content="([^"]*)"\s+name="description"/i);
    if (!metaDescMatch) {
        issues.push('Missing meta description');
    } else if (metaDescMatch[1].length < 120) {
        warnings.push(`Meta description short (${metaDescMatch[1].length} chars)`);
    } else if (metaDescMatch[1].length > 160) {
        warnings.push(`Meta description long (${metaDescMatch[1].length} chars)`);
    } else {
        passed.push(`Meta description OK (${metaDescMatch[1].length} chars)`);
    }
    
    // 3. H1 Tag
    const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
    if (!h1Match) {
        issues.push('Missing H1 tag');
    } else {
        passed.push('H1 tag present');
    }
    
    // 4. Canonical URL
    const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
    if (!canonicalMatch) {
        issues.push('Missing canonical URL');
    } else {
        passed.push('Canonical URL present');
    }
    
    // 5. Open Graph Tags
    const ogTitle = html.match(/<meta\s+property="og:title"/i);
    const ogDesc = html.match(/<meta\s+property="og:description"/i);
    const ogImage = html.match(/<meta\s+property="og:image"/i);
    const ogUrl = html.match(/<meta\s+property="og:url"/i);
    
    if (!ogTitle) issues.push('Missing og:title');
    else passed.push('og:title present');
    
    if (!ogDesc) issues.push('Missing og:description');
    else passed.push('og:description present');
    
    if (!ogImage) warnings.push('Missing og:image');
    else passed.push('og:image present');
    
    if (!ogUrl) issues.push('Missing og:url');
    else passed.push('og:url present');
    
    // 6. Twitter Card Tags
    const twitterCard = html.match(/<meta\s+name="twitter:card"/i);
    if (!twitterCard) warnings.push('Missing twitter:card');
    else passed.push('twitter:card present');
    
    // 7. Schema.org Structured Data
    const schemaMatch = html.match(/<script\s+type="application\/ld\+json">/i);
    if (!schemaMatch) {
        warnings.push('Missing Schema.org structured data');
    } else {
        passed.push('Schema.org JSON-LD present');
    }
    
    // 8. Images with Alt Text
    const images = html.match(/<img[^>]*>/gi) || [];
    const imagesWithoutAlt = images.filter(img => !img.match(/alt="[^"]+"/i));
    if (imagesWithoutAlt.length > 0) {
        warnings.push(`${imagesWithoutAlt.length} images missing alt text`);
    } else if (images.length > 0) {
        passed.push(`All ${images.length} images have alt text`);
    }
    
    // 9. Internal Links
    const internalLinks = (html.match(/href="\//g) || []).length;
    if (internalLinks < 3) {
        warnings.push(`Low internal links (${internalLinks})`);
    } else {
        passed.push(`Good internal linking (${internalLinks} links)`);
    }
    
    // 10. Meta Keywords (optional but good to have)
    const keywords = html.match(/<meta\s+name="keywords"/i);
    if (keywords) passed.push('Meta keywords present');
    
    // Calculate SEO Score
    const totalChecks = issues.length + warnings.length + passed.length;
    const score = Math.round((passed.length / totalChecks) * 100);
    
    return {
        path: relativePath,
        score,
        issues,
        warnings,
        passed,
        title: titleMatch ? titleMatch[1] : 'MISSING',
        hasH1: !!h1Match,
        hasCanonical: !!canonicalMatch,
        hasSchema: !!schemaMatch
    };
}


// ============================================
// LINK CRAWLER - Find Broken Links
// ============================================

function extractLinks(html, currentPath) {
    const links = [];
    const linkRegex = /href="([^"]+)"/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        
        // Skip anchors, mailto, tel, javascript
        if (href.startsWith('#') || href.startsWith('mailto:') || 
            href.startsWith('tel:') || href.startsWith('javascript:')) {
            continue;
        }
        
        links.push({
            href,
            isExternal: href.startsWith('http'),
            isInternal: href.startsWith('/'),
            source: currentPath
        });
    }
    
    return links;
}

function checkInternalLink(href) {
    // Convert href to file path
    let filePath = href;
    if (filePath.endsWith('/')) {
        filePath += 'index.html';
    } else if (!filePath.includes('.')) {
        filePath += '/index.html';
    }
    
    const fullPath = path.join(CONFIG.distDir, filePath);
    return fs.existsSync(fullPath);
}

// ============================================
// DISCOVERABILITY CHECK
// ============================================

function buildLinkGraph() {
    console.log('\n📊 Building link graph for discoverability analysis...');
    
    const linkGraph = new Map(); // page -> pages it links to
    const reverseGraph = new Map(); // page -> pages that link to it
    const allPages = new Set();
    
    // Find all HTML files
    function findHtmlFiles(dir, files = []) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                findHtmlFiles(fullPath, files);
            } else if (item.endsWith('.html')) {
                files.push(fullPath);
            }
        }
        return files;
    }
    
    const htmlFiles = findHtmlFiles(CONFIG.distDir);
    console.log(`   Found ${htmlFiles.length} HTML files`);
    
    // Build graph
    for (const file of htmlFiles) {
        const relativePath = file.replace(CONFIG.distDir, '').replace('/index.html', '/') || '/';
        allPages.add(relativePath);
        linkGraph.set(relativePath, []);
        
        const html = fs.readFileSync(file, 'utf8');
        const links = extractLinks(html, relativePath);
        
        for (const link of links) {
            if (link.isInternal) {
                let targetPath = link.href;
                if (!targetPath.endsWith('/')) targetPath += '/';
                
                linkGraph.get(relativePath).push(targetPath);
                
                if (!reverseGraph.has(targetPath)) {
                    reverseGraph.set(targetPath, []);
                }
                reverseGraph.get(targetPath).push(relativePath);
            }
        }
    }
    
    return { linkGraph, reverseGraph, allPages };
}

function findOrphanPages(reverseGraph, allPages) {
    const orphans = [];
    const homepage = '/';
    
    for (const page of allPages) {
        if (page === homepage) continue;
        
        const incomingLinks = reverseGraph.get(page) || [];
        // Filter out self-links
        const externalIncoming = incomingLinks.filter(l => l !== page);
        
        if (externalIncoming.length === 0) {
            orphans.push(page);
        }
    }
    
    return orphans;
}

function calculateDiscoverability(linkGraph, reverseGraph, allPages) {
    // BFS from homepage to find reachable pages
    const visited = new Set();
    const queue = ['/'];
    const depth = new Map();
    depth.set('/', 0);
    
    while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current)) continue;
        visited.add(current);
        
        const links = linkGraph.get(current) || [];
        for (const link of links) {
            if (!visited.has(link) && allPages.has(link)) {
                queue.push(link);
                if (!depth.has(link)) {
                    depth.set(link, depth.get(current) + 1);
                }
            }
        }
    }
    
    return {
        reachable: visited.size,
        total: allPages.size,
        unreachable: allPages.size - visited.size,
        depthDistribution: depth
    };
}


// ============================================
// SITEMAP COMPARISON
// ============================================

function loadGeneratedSitemap() {
    const sitemapPath = path.join(CONFIG.distDir, 'sitemap.xml');
    if (!fs.existsSync(sitemapPath)) {
        return [];
    }
    
    const xml = fs.readFileSync(sitemapPath, 'utf8');
    const urls = [];
    const regex = /<loc>([^<]+)<\/loc>/g;
    let match;
    
    while ((match = regex.exec(xml)) !== null) {
        urls.push(match[1]);
    }
    
    return urls;
}

function loadWordPressSitemap() {
    // Load from wordpress-data.json
    const wpDataPath = path.join(CONFIG.dataDir, 'wordpress-data.json');
    if (!fs.existsSync(wpDataPath)) {
        return [];
    }
    
    const wpData = JSON.parse(fs.readFileSync(wpDataPath, 'utf8'));
    const urls = [];
    
    for (const page of (wpData.pages || [])) {
        if (page.link) urls.push(page.link);
    }
    for (const post of (wpData.posts || [])) {
        if (post.link) urls.push(post.link);
    }
    
    return urls;
}

function compareSitemaps() {
    console.log('\n📍 Comparing sitemaps...');
    
    const generatedUrls = loadGeneratedSitemap();
    const wordpressUrls = loadWordPressSitemap();
    
    // Normalize URLs for comparison
    const normalizeUrl = (url) => {
        return url.replace('https://marga.biz', '')
                  .replace('https://marga-biz.netlify.app', '')
                  .replace(/\/$/, '') || '/';
    };
    
    const generatedPaths = new Set(generatedUrls.map(normalizeUrl));
    const wordpressPaths = new Set(wordpressUrls.map(normalizeUrl));
    
    const inBoth = [...generatedPaths].filter(p => wordpressPaths.has(p));
    const onlyInGenerated = [...generatedPaths].filter(p => !wordpressPaths.has(p));
    const onlyInWordPress = [...wordpressPaths].filter(p => !generatedPaths.has(p));
    
    return {
        generatedCount: generatedUrls.length,
        wordpressCount: wordpressUrls.length,
        matchingCount: inBoth.length,
        onlyInGenerated,
        onlyInWordPress,
        matchPercentage: Math.round((inBoth.length / wordpressUrls.length) * 100)
    };
}

// ============================================
// BROKEN LINK CHECKER
// ============================================

function findBrokenLinks() {
    console.log('\n🔗 Checking for broken internal links...');
    
    const brokenLinks = [];
    
    function findHtmlFiles(dir, files = []) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                findHtmlFiles(fullPath, files);
            } else if (item.endsWith('.html')) {
                files.push(fullPath);
            }
        }
        return files;
    }
    
    const htmlFiles = findHtmlFiles(CONFIG.distDir);
    let checked = 0;
    
    for (const file of htmlFiles) {
        const relativePath = file.replace(CONFIG.distDir, '');
        const html = fs.readFileSync(file, 'utf8');
        const links = extractLinks(html, relativePath);
        
        for (const link of links) {
            if (link.isInternal && !checkInternalLink(link.href)) {
                brokenLinks.push({
                    source: relativePath,
                    brokenLink: link.href
                });
            }
        }
        
        checked++;
        if (checked % 200 === 0) {
            console.log(`   Checked ${checked}/${htmlFiles.length} pages...`);
        }
    }
    
    console.log(`   ✅ Checked ${htmlFiles.length} pages`);
    return brokenLinks;
}


// ============================================
// FULL SEO AUDIT ON ALL PAGES
// ============================================

function runFullSEOAudit() {
    console.log('\n📝 Running full SEO audit on all pages...');
    
    const results = [];
    
    function findHtmlFiles(dir, files = []) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                findHtmlFiles(fullPath, files);
            } else if (item.endsWith('.html')) {
                files.push(fullPath);
            }
        }
        return files;
    }
    
    const htmlFiles = findHtmlFiles(CONFIG.distDir);
    let checked = 0;
    
    for (const file of htmlFiles) {
        const html = fs.readFileSync(file, 'utf8');
        const seoResult = checkPageSEO(file, html);
        results.push(seoResult);
        
        checked++;
        if (checked % 200 === 0) {
            console.log(`   Audited ${checked}/${htmlFiles.length} pages...`);
        }
    }
    
    console.log(`   ✅ Audited ${htmlFiles.length} pages`);
    return results;
}

// ============================================
// GENERATE REPORTS
// ============================================

function generateReports(seoResults, brokenLinks, discoverability, sitemapComparison, orphanPages) {
    console.log('\n📊 Generating reports...');
    
    // Calculate overall stats
    const avgScore = Math.round(seoResults.reduce((sum, r) => sum + r.score, 0) / seoResults.length);
    const perfectPages = seoResults.filter(r => r.score === 100).length;
    const criticalIssues = seoResults.filter(r => r.issues.length > 0);
    
    // Score distribution
    const scoreDistribution = {
        excellent: seoResults.filter(r => r.score >= 90).length,
        good: seoResults.filter(r => r.score >= 70 && r.score < 90).length,
        needsWork: seoResults.filter(r => r.score >= 50 && r.score < 70).length,
        poor: seoResults.filter(r => r.score < 50).length
    };
    
    // Top issues
    const issueCount = {};
    for (const result of seoResults) {
        for (const issue of result.issues) {
            issueCount[issue] = (issueCount[issue] || 0) + 1;
        }
        for (const warning of result.warnings) {
            issueCount[warning] = (issueCount[warning] || 0) + 1;
        }
    }
    
    const topIssues = Object.entries(issueCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    // Generate summary report
    const report = {
        generatedAt: new Date().toISOString(),
        siteUrl: CONFIG.siteUrl,
        
        summary: {
            totalPages: seoResults.length,
            averageSEOScore: avgScore,
            perfectScorePages: perfectPages,
            pagesWithCriticalIssues: criticalIssues.length,
            brokenLinksFound: brokenLinks.length,
            orphanPages: orphanPages.length
        },
        
        scoreDistribution,
        
        discoverability: {
            reachableFromHomepage: discoverability.reachable,
            totalPages: discoverability.total,
            unreachablePages: discoverability.unreachable,
            coveragePercent: Math.round((discoverability.reachable / discoverability.total) * 100)
        },
        
        sitemapComparison: {
            generatedSitemapUrls: sitemapComparison.generatedCount,
            wordPressSitemapUrls: sitemapComparison.wordpressCount,
            matchingUrls: sitemapComparison.matchingCount,
            matchPercent: sitemapComparison.matchPercentage,
            missingFromGenerated: sitemapComparison.onlyInWordPress.length,
            extraInGenerated: sitemapComparison.onlyInGenerated.length
        },
        
        topIssues,
        
        brokenLinks: brokenLinks.slice(0, 50),
        
        lowestScoringPages: seoResults
            .sort((a, b) => a.score - b.score)
            .slice(0, 20)
            .map(r => ({ path: r.path, score: r.score, issues: r.issues })),
        
        orphanPages: orphanPages.slice(0, 50)
    };
    
    // Save JSON report
    const jsonPath = path.join(CONFIG.outputDir, 'seo-audit-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`   ✅ JSON report: ${jsonPath}`);
    
    // Save detailed CSV
    const csvLines = ['Path,Score,Issues,Warnings,Title,HasH1,HasCanonical,HasSchema'];
    for (const r of seoResults) {
        csvLines.push(`"${r.path}",${r.score},${r.issues.length},${r.warnings.length},"${r.title.replace(/"/g, '""')}",${r.hasH1},${r.hasCanonical},${r.hasSchema}`);
    }
    const csvPath = path.join(CONFIG.outputDir, 'seo-audit-details.csv');
    fs.writeFileSync(csvPath, csvLines.join('\n'));
    console.log(`   ✅ CSV report: ${csvPath}`);
    
    return report;
}


// ============================================
// PRINT CONSOLE REPORT
// ============================================

function printReport(report) {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 SEO AUDIT REPORT');
    console.log('='.repeat(60));
    
    console.log('\n📊 SUMMARY');
    console.log('-'.repeat(40));
    console.log(`   Total Pages Audited: ${report.summary.totalPages}`);
    console.log(`   Average SEO Score: ${report.summary.averageSEOScore}/100`);
    console.log(`   Perfect Score Pages: ${report.summary.perfectScorePages}`);
    console.log(`   Pages with Critical Issues: ${report.summary.pagesWithCriticalIssues}`);
    console.log(`   Broken Links Found: ${report.summary.brokenLinksFound}`);
    console.log(`   Orphan Pages: ${report.summary.orphanPages}`);
    
    console.log('\n📈 SCORE DISTRIBUTION');
    console.log('-'.repeat(40));
    console.log(`   🟢 Excellent (90-100): ${report.scoreDistribution.excellent} pages`);
    console.log(`   🟡 Good (70-89): ${report.scoreDistribution.good} pages`);
    console.log(`   🟠 Needs Work (50-69): ${report.scoreDistribution.needsWork} pages`);
    console.log(`   🔴 Poor (<50): ${report.scoreDistribution.poor} pages`);
    
    console.log('\n🔍 DISCOVERABILITY (from Homepage)');
    console.log('-'.repeat(40));
    console.log(`   Reachable Pages: ${report.discoverability.reachableFromHomepage}/${report.discoverability.totalPages}`);
    console.log(`   Coverage: ${report.discoverability.coveragePercent}%`);
    console.log(`   Unreachable (Orphan): ${report.discoverability.unreachablePages}`);
    
    console.log('\n📍 SITEMAP COMPARISON');
    console.log('-'.repeat(40));
    console.log(`   Generated Sitemap URLs: ${report.sitemapComparison.generatedSitemapUrls}`);
    console.log(`   WordPress Sitemap URLs: ${report.sitemapComparison.wordPressSitemapUrls}`);
    console.log(`   Matching URLs: ${report.sitemapComparison.matchingUrls} (${report.sitemapComparison.matchPercent}%)`);
    console.log(`   Missing from Generated: ${report.sitemapComparison.missingFromGenerated}`);
    
    console.log('\n⚠️  TOP ISSUES');
    console.log('-'.repeat(40));
    for (const [issue, count] of report.topIssues.slice(0, 5)) {
        console.log(`   ${count}x - ${issue}`);
    }
    
    if (report.brokenLinks.length > 0) {
        console.log('\n🔗 BROKEN LINKS (first 10)');
        console.log('-'.repeat(40));
        for (const link of report.brokenLinks.slice(0, 10)) {
            console.log(`   ${link.source}`);
            console.log(`      → ${link.brokenLink}`);
        }
    }
    
    if (report.lowestScoringPages.length > 0) {
        console.log('\n📉 LOWEST SCORING PAGES');
        console.log('-'.repeat(40));
        for (const page of report.lowestScoringPages.slice(0, 5)) {
            console.log(`   ${page.score}/100 - ${page.path}`);
            if (page.issues.length > 0) {
                console.log(`      Issues: ${page.issues.join(', ')}`);
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📁 Full reports saved to: reports/');
    console.log('='.repeat(60));
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    try {
        // 1. Run full SEO audit
        const seoResults = runFullSEOAudit();
        
        // 2. Find broken links
        const brokenLinks = findBrokenLinks();
        
        // 3. Build link graph and check discoverability
        const { linkGraph, reverseGraph, allPages } = buildLinkGraph();
        const discoverability = calculateDiscoverability(linkGraph, reverseGraph, allPages);
        const orphanPages = findOrphanPages(reverseGraph, allPages);
        
        // 4. Compare sitemaps
        const sitemapComparison = compareSitemaps();
        
        // 5. Generate reports
        const report = generateReports(seoResults, brokenLinks, discoverability, sitemapComparison, orphanPages);
        
        // 6. Print console report
        printReport(report);
        
        const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);
        console.log(`\n⏱️  Total audit time: ${duration}s\n`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
