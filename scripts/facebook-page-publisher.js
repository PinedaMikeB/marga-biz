#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    loadLocalEnv,
    getRequiredEnv
} = require('./lib/telegram-gateway');

const CONFIG = {
    repoRoot: path.join(__dirname, '..'),
    staticPagesDir: path.join(__dirname, '../static-pages'),
    stateFile: path.join(__dirname, '../temp/facebook-page-publisher-state.json'),
    reportsDir: path.join(__dirname, '../reports/facebook'),
    latestMarkdownFile: path.join(__dirname, '../reports/facebook/latest.md'),
    latestJsonFile: path.join(__dirname, '../reports/facebook/latest.json'),
    baseUrl: 'https://marga.biz',
    graphVersion: 'v25.0',
    defaultListLimit: 10
};

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function parseArgs(argv) {
    const [command = 'preview-next', ...rest] = argv;
    const options = {};

    for (const arg of rest) {
        if (!arg.startsWith('--')) {
            continue;
        }

        const separatorIndex = arg.indexOf('=');
        if (separatorIndex === -1) {
            options[arg.slice(2)] = true;
            continue;
        }

        options[arg.slice(2, separatorIndex)] = arg.slice(separatorIndex + 1);
    }

    return { command, options };
}

function readJson(filePath, fallback) {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

function writeJson(filePath, payload) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function compactWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTagContent(html, tagName) {
    const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
    return compactWhitespace(match ? match[1] : '');
}

function extractMetaContent(html, selectorType, selectorName) {
    const escaped = escapeRegex(selectorName);
    const patterns = [
        new RegExp(`<meta\\s+[^>]*${selectorType}=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i'),
        new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${selectorType}=["']${escaped}["'][^>]*>`, 'i')
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
            return compactWhitespace(match[1]);
        }
    }

    return '';
}

function extractCanonicalUrl(html) {
    const match = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
        html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
    return compactWhitespace(match ? match[1] : '');
}

function cleanTitle(title) {
    return compactWhitespace(String(title || '').replace(/\s*\|\s*Marga Enterprises.*$/i, ''));
}

function titleCaseSlug(slug) {
    return String(slug || '')
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeUrlPath(filePath) {
    const relativePath = path.relative(CONFIG.staticPagesDir, filePath).split(path.sep).join('/');
    const publicPath = relativePath
        .replace(/index\.html$/i, '')
        .replace(/\/$/, '');

    return publicPath ? `/${publicPath}/` : '/';
}

function shouldIncludePage(relativePath) {
    const normalized = relativePath.split(path.sep).join('/');

    if (!normalized.endsWith('/index.html') && normalized !== 'index.html') {
        return false;
    }

    if (normalized === 'terms-of-service/index.html' || normalized === 'about/index.html' || normalized === 'contact/index.html') {
        return false;
    }

    return true;
}

function walkHtmlFiles(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const nextPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkHtmlFiles(nextPath));
            continue;
        }

        if (entry.isFile() && entry.name === 'index.html') {
            files.push(nextPath);
        }
    }

    return files;
}

function detectLocation(record) {
    const haystack = `${record.relativePath} ${record.title} ${record.metaDescription}`.toLowerCase();
    const locations = [
        'pasig',
        'makati',
        'manila',
        'ortigas',
        'quezon city',
        'bgc'
    ];

    const found = locations.find(location => haystack.includes(location));
    return found ? titleCaseSlug(found) : '';
}

function buildHashtags(record) {
    const hashtags = ['#MargaEnterprises', '#PrinterRental'];
    const location = detectLocation(record);

    if (/copier/i.test(record.title) || /copier/i.test(record.metaDescription)) {
        hashtags.push('#CopierRental');
    } else {
        hashtags.push('#OfficePrinterRental');
    }

    if (location) {
        hashtags.push(`#${location.replace(/\s+/g, '')}`);
    }

    return Array.from(new Set(hashtags)).join(' ');
}

function truncateSentence(value, maxLength) {
    const text = compactWhitespace(value);
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function buildCaption(record) {
    const location = detectLocation(record);
    const hook = location
        ? `Looking for printer rental in ${location}?`
        : 'Need a reliable printer rental setup for your team?';
    const summary = truncateSentence(
        record.ogDescription || record.metaDescription || record.title,
        180
    );

    return [
        hook,
        '',
        summary,
        '',
        `Read more: ${record.url}`,
        '',
        buildHashtags(record)
    ].join('\n');
}

function readPageRecord(filePath) {
    const html = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    const relativePath = path.relative(CONFIG.staticPagesDir, filePath);
    const title = cleanTitle(
        extractMetaContent(html, 'property', 'og:title') ||
        extractTagContent(html, 'title')
    );
    const metaDescription = extractMetaContent(html, 'name', 'description');
    const ogDescription = extractMetaContent(html, 'property', 'og:description');
    const canonicalUrl = extractCanonicalUrl(html);
    const url = canonicalUrl || `${CONFIG.baseUrl}${normalizeUrlPath(filePath)}`;

    return {
        filePath,
        repoPath: path.relative(CONFIG.repoRoot, filePath),
        relativePath,
        title,
        metaDescription,
        ogDescription,
        url,
        updatedAt: stats.mtime.toISOString(),
        updatedAtMs: stats.mtimeMs
    };
}

function loadEligiblePages() {
    const files = walkHtmlFiles(CONFIG.staticPagesDir)
        .filter(filePath => shouldIncludePage(path.relative(CONFIG.staticPagesDir, filePath)));

    return files
        .map(readPageRecord)
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

function loadState() {
    const state = readJson(CONFIG.stateFile, { published: [] });
    state.published = Array.isArray(state.published) ? state.published : [];
    return state;
}

function saveState(state) {
    writeJson(CONFIG.stateFile, state);
}

function getPublishedEntry(state, url) {
    return state.published.find(entry => entry.url === url);
}

function resolvePageRecord(options) {
    const pages = loadEligiblePages();

    if (options.page) {
        const requestedPath = path.isAbsolute(options.page)
            ? options.page
            : path.join(CONFIG.repoRoot, options.page);
        const matched = pages.find(page => path.resolve(page.filePath) === path.resolve(requestedPath));

        if (!matched) {
            throw new Error(`Page not found or not eligible for posting: ${options.page}`);
        }

        return matched;
    }

    const state = loadState();
    const nextPage = pages.find(page => !getPublishedEntry(state, page.url));

    if (!nextPage) {
        throw new Error('No unpublished static pages are available for Facebook posting.');
    }

    return nextPage;
}

function renderList() {
    const pages = loadEligiblePages();
    const state = loadState();
    const limit = CONFIG.defaultListLimit;

    process.stdout.write('Facebook post queue (curated static pages)\n\n');

    for (const page of pages.slice(0, limit)) {
        const published = getPublishedEntry(state, page.url);
        const status = published ? `POSTED ${published.publishedAt}` : 'READY';
        process.stdout.write(`- [${status}] ${page.title}\n`);
        process.stdout.write(`  ${page.url}\n`);
    }
}

function writeReport(mode, record, message, extra = {}) {
    ensureDir(CONFIG.reportsDir);

    const payload = {
        mode,
        generatedAt: new Date().toISOString(),
        page: {
            title: record.title,
            url: record.url,
            file: record.repoPath,
            updatedAt: record.updatedAt
        },
        message,
        ...extra
    };

    const markdown = [
        '# Facebook Page Publisher',
        '',
        `Generated: ${payload.generatedAt}`,
        `Mode: ${mode}`,
        '',
        '## Target Page',
        '',
        `- Title: ${record.title}`,
        `- URL: ${record.url}`,
        `- File: ${record.repoPath}`,
        `- Updated: ${record.updatedAt}`,
        '',
        '## Proposed Message',
        '',
        message,
        ''
    ].join('\n');

    fs.writeFileSync(CONFIG.latestMarkdownFile, markdown);
    writeJson(CONFIG.latestJsonFile, payload);
}

async function publishToFacebook(record, message, options) {
    loadLocalEnv();

    const pageId = getRequiredEnv('FACEBOOK_PAGE_ID');
    const accessToken = getRequiredEnv('FACEBOOK_PAGE_ACCESS_TOKEN');
    const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || CONFIG.graphVersion;
    const endpoint = `https://graph.facebook.com/${graphVersion}/${pageId}/feed`;
    const params = new URLSearchParams({
        message,
        link: record.url,
        access_token: accessToken
    });

    if (options['schedule-at']) {
        const scheduledAt = new Date(options['schedule-at']);
        if (Number.isNaN(scheduledAt.getTime())) {
            throw new Error(`Invalid --schedule-at value: ${options['schedule-at']}`);
        }

        params.set('published', 'false');
        params.set('scheduled_publish_time', String(Math.floor(scheduledAt.getTime() / 1000)));
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    const payload = await response.json();

    if (!response.ok || payload.error) {
        const errorMessage = payload?.error?.message || `Facebook API error (${response.status})`;
        throw new Error(errorMessage);
    }

    return payload;
}

function markPublished(record, postId, mode) {
    const state = loadState();
    const existing = getPublishedEntry(state, record.url);

    const nextEntry = {
        url: record.url,
        title: record.title,
        file: record.repoPath,
        postId,
        mode,
        publishedAt: new Date().toISOString()
    };

    if (existing) {
        Object.assign(existing, nextEntry);
    } else {
        state.published.push(nextEntry);
    }

    saveState(state);
}

function previewRecord(record) {
    const message = buildCaption(record);
    writeReport('preview', record, message);

    process.stdout.write(`Preview ready for ${record.title}\n\n`);
    process.stdout.write(`${message}\n`);
}

async function publishRecord(record, options) {
    const message = buildCaption(record);
    const response = await publishToFacebook(record, message, options);
    const postId = response.id || 'unknown';
    const mode = options['schedule-at'] ? 'scheduled' : 'published';

    markPublished(record, postId, mode);
    writeReport(mode, record, message, { facebookResponse: response });

    process.stdout.write(`${mode === 'scheduled' ? 'Scheduled' : 'Published'} Facebook post for ${record.title}\n`);
    process.stdout.write(`Post ID: ${postId}\n`);
}

function markRecordAsPosted(record, options) {
    const postId = options['post-id'] || 'manual';
    markPublished(record, postId, 'manual');

    process.stdout.write(`Marked ${record.title} as posted.\n`);
    process.stdout.write(`Post ID: ${postId}\n`);
}

async function main() {
    const { command, options } = parseArgs(process.argv.slice(2));

    switch (command) {
        case 'list':
            renderList();
            return;
        case 'preview':
        case 'preview-next':
            previewRecord(resolvePageRecord(options));
            return;
        case 'publish':
        case 'publish-next':
            await publishRecord(resolvePageRecord(options), options);
            return;
        case 'mark-posted':
            markRecordAsPosted(resolvePageRecord(options), options);
            return;
        default:
            throw new Error(`Unsupported command: ${command}`);
    }
}

main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
});
