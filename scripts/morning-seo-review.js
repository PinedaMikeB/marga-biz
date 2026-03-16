/**
 * Morning SEO review generator.
 *
 * Runs the Google SERP monitor if configured, updates tracker snapshot lines,
 * prepares a daily approval brief, and sends it through Telegram.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CONFIG = {
    repoRoot: path.join(__dirname, '..'),
    trackerFile: path.join(__dirname, '../reports/location-seo-tracker.md'),
    roadmapFile: path.join(__dirname, '../reports/location-ranking-roadmap.md'),
    serpLatestFile: path.join(__dirname, '../reports/serp-monitor/latest.json'),
    reviewDir: path.join(__dirname, '../reports/morning-seo-review'),
    requestFile: path.join(__dirname, '../temp/current-approval-request.json')
};

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

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
    loadEnvFile(path.join(CONFIG.repoRoot, '.env.local'));
    loadEnvFile(path.join(CONFIG.repoRoot, '.env'));
}

function runNodeScript(scriptName, args = []) {
    const result = spawnSync('node', [path.join(CONFIG.repoRoot, scriptName), ...args], {
        cwd: CONFIG.repoRoot,
        encoding: 'utf8'
    });

    return result;
}

function maybeRunSerpMonitor() {
    if (!process.env.SERPAPI_KEY) {
        return {
            ran: false,
            message: 'SERPAPI_KEY not configured; reused previous SERP snapshot.'
        };
    }

    const result = runNodeScript('scripts/serp-monitor.js', ['--engines=google']);
    if (result.status !== 0) {
        return {
            ran: true,
            message: `SERP monitor failed: ${result.stderr || result.stdout}`.trim()
        };
    }

    return {
        ran: true,
        message: 'SERP monitor completed for Google.'
    };
}

function readJson(filePath, fallback = null) {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

function summarizeTrackedKeywords(results = []) {
    const tracked = [
        'printer rental makati',
        'printer rental bgc',
        'printer rental pasig',
        'printer rental ortigas',
        'printer rental quezon city',
        'printer rental manila'
    ];

    return tracked
        .map(keyword => results.find(result => result.engine === 'google' && result.keyword === keyword))
        .filter(Boolean)
        .map(result => ({
            keyword: result.keyword,
            rank: result.ourRank ?? 'Not in top 10',
            url: result.ourUrl || 'none'
        }));
}

function updateTrackerSnapshot(summary) {
    let tracker = fs.readFileSync(CONFIG.trackerFile, 'utf8');

    tracker = tracker.replace(
        '- `[ ]` daily or morning review automation',
        '- `[x]` daily or morning review automation'
    );

    const snapshotLines = summary.map(
        item => `- \`${item.keyword}\`: rank ${item.rank} on Google snapshot, ${item.url === 'none' ? 'not ranking in top 10 yet' : `ranking URL: ${item.url}`}`
    );

    const replacement = [
        '## Last Verified Snapshot',
        '',
        ...snapshotLines,
        '',
        '## Operating Rule'
    ].join('\n');

    tracker = tracker.replace(/## Last Verified Snapshot[\s\S]*?## Operating Rule/, replacement);
    tracker = tracker.replace(
        /Updated: \d{4}-\d{2}-\d{2}/,
        `Updated: ${new Date().toISOString().slice(0, 10)}`
    );

    fs.writeFileSync(CONFIG.trackerFile, tracker);
}

function getProposedActions() {
    const tracker = fs.readFileSync(CONFIG.trackerFile, 'utf8');
    const match = tracker.match(/## Approval Queue[\s\S]*?(?=\n## |\n$)/);
    if (!match) {
        return [];
    }

    return match[0]
        .split('\n')
        .filter(line => line.startsWith('- `[?]`'))
        .map(line => line.replace('- `[?]` ', '').trim())
        .slice(0, 3);
}

function buildReviewMarkdown(summary, serpStatus, proposedActions, approvalId) {
    const lines = [
        '# Morning SEO Review',
        '',
        `Generated: ${new Date().toISOString()}`,
        `Approval ID: \`${approvalId}\``,
        '',
        '## Rank Snapshot',
        ''
    ];

    for (const item of summary) {
        lines.push(`- ${item.keyword}: ${item.rank} (${item.url})`);
    }

    lines.push('', '## SERP Monitor', '', `- ${serpStatus.message}`);
    lines.push('', '## Proposed Next Actions', '');

    for (const action of proposedActions) {
        lines.push(`- ${action}`);
    }

    lines.push(
        '',
        '## Approval Rule',
        '',
        '- Approve = proceed with only the first approved action as one small verified change set.',
        '- Reject = no code or content changes will be made.'
    );

    return lines.join('\n');
}

function writeReviewFiles(markdown, approvalId, proposedActions, summary) {
    ensureDir(CONFIG.reviewDir);
    ensureDir(path.dirname(CONFIG.requestFile));

    fs.writeFileSync(path.join(CONFIG.reviewDir, 'latest.md'), markdown);
    fs.writeFileSync(
        path.join(CONFIG.reviewDir, 'latest.json'),
        JSON.stringify(
            {
                approvalId,
                generatedAt: new Date().toISOString(),
                proposedActions,
                summary
            },
            null,
            2
        )
    );

    fs.writeFileSync(
        CONFIG.requestFile,
        JSON.stringify(
            {
                approvalId,
                generatedAt: new Date().toISOString(),
                status: 'pending',
                processed: false,
                proposedActions
            },
            null,
            2
        )
    );
}

function sendTelegramApproval(approvalId) {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
        return 'Telegram is not configured; skipped approval message.';
    }

    const result = runNodeScript('scripts/telegram-approval.js', [
        'send-review',
        `--approval-id=${approvalId}`,
        '--title=9AM SEO Review',
        '--body-file=reports/morning-seo-review/latest.md'
    ]);

    if (result.status !== 0) {
        return `Telegram send failed: ${(result.stderr || result.stdout).trim()}`;
    }

    return (result.stdout || 'Telegram approval sent.').trim();
}

function main() {
    loadLocalEnv();

    const serpStatus = maybeRunSerpMonitor();
    const latest = readJson(CONFIG.serpLatestFile, { results: [] });
    const summary = summarizeTrackedKeywords(latest.results || []);

    if (summary.length) {
        updateTrackerSnapshot(summary);
    }

    const proposedActions = getProposedActions();
    const approvalId = `seo-review-${new Date().toISOString().slice(0, 10)}`;
    const markdown = buildReviewMarkdown(summary, serpStatus, proposedActions, approvalId);

    writeReviewFiles(markdown, approvalId, proposedActions, summary);
    const telegramStatus = sendTelegramApproval(approvalId);

    process.stdout.write(`${markdown}\n\n## Telegram\n\n- ${telegramStatus}\n`);
}

main();
