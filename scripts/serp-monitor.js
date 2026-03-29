/**
 * SERP monitor for Google and Bing.
 *
 * Official parameter references used for this script:
 * - Google Search API: https://serpapi.com/search-api
 * - Bing Search API: https://serpapi.com/bing-search-api
 *
 * Usage:
 *   SERPAPI_KEY=... node scripts/serp-monitor.js
 *   SERPAPI_KEY=... node scripts/serp-monitor.js --set=all
 *   SERPAPI_KEY=... node scripts/serp-monitor.js --engines=google,bing
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
    apiUrl: 'https://serpapi.com/search.json',
    outputDir: path.join(__dirname, '../reports/serp-monitor'),
    keywordFile: path.join(__dirname, '../data/serp-keywords.json'),
    trackedDomain: 'marga.biz',
    google: {
        engine: 'google',
        google_domain: 'google.com',
        gl: 'ph',
        hl: 'en',
        num: '10'
    },
    bing: {
        engine: 'bing',
        cc: 'ph',
        mkt: 'en-PH'
    }
};

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();

        if (!key || process.env[key]) {
            continue;
        }

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

function loadLocalEnv() {
    const repoRoot = path.join(__dirname, '..');
    loadEnvFile(path.join(repoRoot, '.env.local'));
    loadEnvFile(path.join(repoRoot, '.env'));
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function parseArgs(argv) {
    const options = {
        set: 'primary',
        engines: ['google', 'bing']
    };

    for (const arg of argv) {
        if (arg.startsWith('--set=')) {
            options.set = arg.split('=')[1];
        } else if (arg.startsWith('--engines=')) {
            options.engines = arg
                .split('=')[1]
                .split(',')
                .map(item => item.trim())
                .filter(Boolean);
        }
    }

    return options;
}

function loadKeywordConfig(setName) {
    const config = JSON.parse(fs.readFileSync(CONFIG.keywordFile, 'utf8'));

    if (setName === 'all') {
        return {
            config,
            keywords: [...config.primary, ...config.secondary]
        };
    }

    if (!config[setName]) {
        throw new Error(`Unknown keyword set "${setName}". Available sets: ${Object.keys(config).join(', ')}`);
    }

    return {
        config,
        keywords: config[setName]
    };
}

function normalizeHostname(urlString = '') {
    try {
        return new URL(urlString).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function summarizeResults(engine, keywordEntry, payload) {
    const organicResults = Array.isArray(payload.organic_results) ? payload.organic_results : [];
    const topOrganic = organicResults.slice(0, 10).map((result, index) => ({
        position: result.position || index + 1,
        title: result.title || '',
        link: result.link || '',
        domain: normalizeHostname(result.link || '')
    }));

    const ourHit = topOrganic.find(result =>
        result.domain === CONFIG.trackedDomain || result.domain.endsWith(`.${CONFIG.trackedDomain}`)
    ) || null;

    const competitors = [];
    for (const result of topOrganic) {
        if (!result.domain) continue;
        if (result.domain === CONFIG.trackedDomain || result.domain.endsWith(`.${CONFIG.trackedDomain}`)) continue;
        if (!competitors.includes(result.domain)) competitors.push(result.domain);
    }

    return {
        checkedAt: new Date().toISOString(),
        engine,
        keyword: keywordEntry.keyword,
        area: keywordEntry.area,
        searchLocation: keywordEntry.searchLocation,
        ourRank: ourHit ? ourHit.position : null,
        ourUrl: ourHit ? ourHit.link : '',
        totalResults: payload.search_information?.total_results || null,
        competitors: competitors.slice(0, 5),
        topOrganic,
        rawMetadata: {
            searchUrl: payload.search_metadata?.google_url || payload.search_metadata?.bing_url || '',
            status: payload.search_metadata?.status || ''
        }
    };
}

async function runSerpQuery(apiKey, engine, keywordEntry) {
    const engineConfig = CONFIG[engine];
    if (!engineConfig) {
        throw new Error(`Unsupported engine "${engine}"`);
    }

    const locationCandidates = [
        keywordEntry.searchLocation,
        keywordEntry.fallbackLocation,
        'Metro Manila, Philippines'
    ].filter((value, index, array) => value && array.indexOf(value) === index);

    let lastError = null;

    for (const location of locationCandidates) {
        const searchParams = new URLSearchParams({
            api_key: apiKey,
            q: keywordEntry.keyword,
            location,
            no_cache: 'true'
        });

        for (const [key, value] of Object.entries(engineConfig)) {
            searchParams.set(key, value);
        }

        let response;
        try {
            response = await fetch(`${CONFIG.apiUrl}?${searchParams.toString()}`);
        } catch (error) {
            throw new Error(`SERPAPI ${engine} ${keywordEntry.keyword} fetch failed`);
        }

        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            throw new Error(`SERPAPI ${engine} ${keywordEntry.keyword} invalid JSON response (${response.status})`);
        }

        if (response.ok && !payload.error) {
            const summary = summarizeResults(engine, keywordEntry, payload);
            summary.resolvedLocation = location;
            return summary;
        }

        lastError = payload.error || `SerpApi request failed (${response.status})`;

        if (!String(lastError).includes('Unsupported') || !String(lastError).includes('location')) {
            break;
        }
    }

    throw new Error(`SerpApi error for ${engine} / ${keywordEntry.keyword}: ${lastError}`);
}

function writeKeywordListReport(config) {
    const lines = [
        '# Keyword Tracking List',
        '',
        '## Primary',
        ''
    ];

    for (const keyword of config.primary) {
        lines.push(`- ${keyword.keyword} (${keyword.searchLocation})`);
    }

    lines.push('', '## Secondary', '');

    for (const keyword of config.secondary) {
        lines.push(`- ${keyword.keyword} (${keyword.searchLocation})`);
    }

    fs.writeFileSync(path.join(CONFIG.outputDir, 'keyword-tracking-list.md'), lines.join('\n'));
}

function writeReports(results, runOptions) {
    ensureDir(CONFIG.outputDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(CONFIG.outputDir, `serp-report-${timestamp}.json`);
    const latestJsonPath = path.join(CONFIG.outputDir, 'latest.json');
    const latestMdPath = path.join(CONFIG.outputDir, 'latest.md');

    const payload = {
        generatedAt: new Date().toISOString(),
        trackedDomain: CONFIG.trackedDomain,
        options: runOptions,
        results
    };

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
    fs.writeFileSync(latestJsonPath, JSON.stringify(payload, null, 2));

    const markdown = [];
    markdown.push('# SERP Monitoring Report', '');
    markdown.push(`Generated: ${payload.generatedAt}`, '');
    markdown.push(`Tracked domain: \`${CONFIG.trackedDomain}\``, '');
    markdown.push('| Engine | Keyword | Area | Rank | URL | Top Competitors |');
    markdown.push('| --- | --- | --- | --- | --- | --- |');

    for (const result of results) {
        markdown.push(
            `| ${result.engine} | ${result.keyword} | ${result.area} | ${result.ourRank ?? 'Not in top 10'} | ${result.ourUrl || '-'} | ${result.competitors.join(', ') || '-'} |`
        );
    }

    markdown.push('', '## Top 10 Snapshot', '');
    for (const result of results) {
        markdown.push(`### ${result.engine.toUpperCase()} - ${result.keyword}`, '');
        for (const organic of result.topOrganic) {
            markdown.push(`${organic.position}. ${organic.title} (${organic.domain || 'unknown'})`);
        }
        markdown.push('');
    }

    fs.writeFileSync(latestMdPath, markdown.join('\n'));
}

async function main() {
    loadLocalEnv();

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
        console.error('Missing SERPAPI_KEY. Add it to .env.local or export it in your shell.');
        process.exit(1);
    }

    const options = parseArgs(process.argv.slice(2));
    const { config, keywords } = loadKeywordConfig(options.set);
    ensureDir(CONFIG.outputDir);
    writeKeywordListReport(config);

    const results = [];

    for (const engine of options.engines) {
        for (const keywordEntry of keywords) {
            process.stdout.write(`Checking ${engine} -> ${keywordEntry.keyword}\n`);
            const summary = await runSerpQuery(apiKey, engine, keywordEntry);
            results.push(summary);
        }
    }

    writeReports(results, options);

    process.stdout.write('\nSummary:\n');
    for (const result of results) {
        process.stdout.write(
            `- ${result.engine} | ${result.keyword} | rank: ${result.ourRank ?? 'Not in top 10'}\n`
        );
    }

    process.stdout.write(`\nReports written to ${CONFIG.outputDir}\n`);
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
