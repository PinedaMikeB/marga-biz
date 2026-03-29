/**
 * Processes Telegram approval decisions for the current morning review request.
 *
 * Commands:
 *   node scripts/process-telegram-approval.js status
 *   node scripts/process-telegram-approval.js mark-processed
 */

const fs = require('fs');
const path = require('path');
const CONFIG = {
    repoRoot: path.join(__dirname, '..'),
    requestFile: path.join(__dirname, '../temp/current-approval-request.json'),
    decisionsFile: path.join(__dirname, '../temp/telegram-approvals.json'),
    reportDir: path.join(__dirname, '../reports/morning-seo-review'),
    statusFile: path.join(__dirname, '../reports/morning-seo-review/approval-status.md')
};

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

function writeJson(filePath, payload) {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function loadRequest() {
    const request = readJson(CONFIG.requestFile, null);
    if (!request) {
        throw new Error('No current approval request found.');
    }
    return request;
}

function latestDecisionFor(approvalId, decisions) {
    const matches = decisions.filter(item => item.approvalId === approvalId);
    if (!matches.length) {
        return null;
    }

    return matches.sort((a, b) => new Date(b.decidedAt) - new Date(a.decidedAt))[0];
}

function normalizeDecision(decision) {
    if (decision === 'approve') return 'approved';
    if (decision === 'reject') return 'rejected';
    return decision;
}

function writeStatusFile(request, decision) {
    const lines = [
        '# Approval Status',
        '',
        `Approval ID: \`${request.approvalId}\``,
        `Status: ${request.status}`,
        `Processed: ${request.processed ? 'yes' : 'no'}`,
        ''
    ];

    if (decision) {
        lines.push(`Decision by: ${decision.user}`);
        lines.push(`Decided at: ${decision.decidedAt}`);
        lines.push('');
    }

    lines.push('## Proposed Actions', '');
    for (const action of request.proposedActions || []) {
        lines.push(`- ${action}`);
    }

    fs.mkdirSync(CONFIG.reportDir, { recursive: true });
    fs.writeFileSync(CONFIG.statusFile, lines.join('\n'));
}

function handleStatus() {
    const request = loadRequest();
    const decisions = readJson(CONFIG.decisionsFile, []);
    const decision = latestDecisionFor(request.approvalId, decisions);

    if (decision && request.status !== normalizeDecision(decision.decision)) {
        request.status = normalizeDecision(decision.decision);
        writeJson(CONFIG.requestFile, request);
    }

    writeStatusFile(request, decision);

    process.stdout.write(`Current request status: ${request.status}\n`);
    if (decision) {
        process.stdout.write(`Latest decision: ${normalizeDecision(decision.decision)} by ${decision.user}\n`);
    }
}

function handleMarkProcessed() {
    const request = loadRequest();
    request.processed = true;
    writeJson(CONFIG.requestFile, request);
    writeStatusFile(request, null);
    process.stdout.write(`Marked ${request.approvalId} as processed.\n`);
}

function main() {
    const command = process.argv[2] || 'status';

    if (command === 'status') {
        handleStatus();
        return;
    }

    if (command === 'mark-processed') {
        handleMarkProcessed();
        return;
    }

    process.stdout.write('Commands:\n  node scripts/process-telegram-approval.js status\n  node scripts/process-telegram-approval.js mark-processed\n');
}

main();
