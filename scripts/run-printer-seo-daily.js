#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { clipText, updateAutomationStatus } = require('./lib/seo-monitor-status');

function getArg(name) {
    const prefix = `--${name}=`;
    const exact = `--${name}`;

    for (const arg of process.argv.slice(2)) {
        if (arg === exact) {
            return true;
        }

        if (arg.startsWith(prefix)) {
            return arg.slice(prefix.length);
        }
    }

    return null;
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function nowStamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function readFileIfExists(filePath, maxLength = 1400) {
    if (!fs.existsSync(filePath)) {
        return '';
    }

    return clipText(fs.readFileSync(filePath, 'utf8'), maxLength);
}

function readLatestSeoReport(repoRoot) {
    const reportPath = path.join(repoRoot, 'reports', 'seo-monitor', 'latest.json');
    if (!fs.existsSync(reportPath)) {
        return null;
    }

    try {
        const payload = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const completedTasks = Array.isArray(payload?.report?.completedTasks) ? payload.report.completedTasks : [];
        return {
            queueStatus: payload?.report?.queueStatus || null,
            latestReportGeneratedAt: payload?.generatedAt || payload?.report?.generatedAt || null,
            completedTasks: completedTasks.map((item) => ({
                task: item.task || '',
                status: item.status || 'Done',
                link: item.link || '',
                implementation: item.implementation || '',
                notes: Array.isArray(payload?.report?.notes) ? payload.report.notes.join(' ') : ''
            }))
        };
    } catch {
        return null;
    }
}

function appendChunkToBuffer(buffer, chunk) {
    const combined = `${buffer.pending}${chunk}`;
    const parts = combined.split(/\r?\n/);
    buffer.pending = parts.pop() || '';

    for (const line of parts) {
        const clean = line.trimEnd();
        if (!clean) continue;
        buffer.lines.push(clean);
    }

    buffer.lines = buffer.lines.slice(-16);
}

async function main() {
    const dryRun = Boolean(getArg('dry-run'));
    const homeDir = os.homedir();
    const repoRoot = process.env.PRINTER_SEO_REPO_ROOT || path.join(homeDir, '.codex', 'repos', 'marga-biz-automation');
    const promptFile = process.env.PRINTER_SEO_PROMPT_FILE || path.join(repoRoot, 'ops', 'printer-seo-daily-prompt.md');
    const codexBin = process.env.CODEX_BIN || '/Applications/Codex.app/Contents/Resources/codex';
    const logDir = process.env.PRINTER_SEO_LOG_DIR || path.join(homeDir, 'Library', 'Logs');
    const lockDir = path.join(homeDir, '.codex', 'locks');
    const lockPath = path.join(lockDir, 'printer-seo-daily.lock');
    const stamp = nowStamp();
    const runLog = path.join(logDir, `printer-seo-daily-${stamp}.log`);
    const lastMessageFile = path.join(logDir, 'printer-seo-daily-last-message.txt');
    const runId = `printer-seo-daily-${stamp}`;
    const statusBase = {
        automationId: 'printer-seo-daily',
        name: 'Printer SEO Daily',
        source: 'launchd',
        runner: 'codex-cli',
        mode: 'local-launchd',
        timezone: 'Asia/Manila',
        runId,
        runLog,
        lastMessageFile
    };

    ensureDir(logDir);
    ensureDir(lockDir);

    if (!fs.existsSync(codexBin)) {
        throw new Error(`Codex CLI not found at ${codexBin}`);
    }

    if (!fs.existsSync(repoRoot)) {
        throw new Error(`Automation repo root not found at ${repoRoot}`);
    }

    if (!fs.existsSync(promptFile)) {
        throw new Error(`Prompt file not found at ${promptFile}`);
    }

    const command = codexBin;
    const args = [
        'exec',
        '--dangerously-bypass-approvals-and-sandbox',
        '--model',
        process.env.PRINTER_SEO_MODEL || 'gpt-5.4',
        '--cd',
        repoRoot,
        '--color',
        'never',
        '--output-last-message',
        lastMessageFile,
        '-'
    ];

    const summary = {
        ok: true,
        dryRun,
        command,
        args,
        repoRoot,
        promptFile,
        runLog,
        lastMessageFile,
        lockPath
    };

    if (dryRun) {
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
        return;
    }

    if (fs.existsSync(lockPath)) {
        await updateAutomationStatus({
            ...statusBase,
            status: 'Blocked',
            currentStep: 'Waiting for previous run',
            message: `Another printer SEO run is still active at ${lockPath}.`,
            updatedAt: new Date().toISOString()
        }).catch(() => {});
        throw new Error(`Printer SEO run already active: ${lockPath}`);
    }

    fs.writeFileSync(lockPath, `${process.pid}\n${new Date().toISOString()}\n`, 'utf8');

    const prompt = fs.readFileSync(promptFile, 'utf8');
    const output = fs.createWriteStream(runLog, { flags: 'a' });
    output.write(`[${new Date().toISOString()}] Starting printer SEO Codex run\n`);
    const logBuffer = {
        lines: [],
        pending: ''
    };
    let lastHeartbeatAt = 0;

    await updateAutomationStatus({
        ...statusBase,
        status: 'Running',
        currentStep: 'Launching Codex CLI',
        message: 'Launchd triggered the local Codex automation runner.',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }).catch(() => {});

    const child = spawn(command, args, {
        cwd: repoRoot,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    const pushHeartbeat = async (force = false) => {
        const now = Date.now();
        if (!force && now - lastHeartbeatAt < 8000) {
            return;
        }

        lastHeartbeatAt = now;
        const liveLogExcerpt = logBuffer.lines.slice(-8).join('\n');
        const message = logBuffer.lines[logBuffer.lines.length - 1] || 'Codex is working through the printer SEO batch.';

        await updateAutomationStatus({
            ...statusBase,
            status: 'Running',
            currentStep: 'Codex execution in progress',
            message,
            liveLogExcerpt,
            updatedAt: new Date().toISOString(),
            heartbeat: true
        }).catch(() => {});
    };

    child.stdout.on('data', (chunk) => {
        output.write(chunk);
        appendChunkToBuffer(logBuffer, chunk.toString('utf8'));
        pushHeartbeat();
    });

    child.stderr.on('data', (chunk) => {
        output.write(chunk);
        appendChunkToBuffer(logBuffer, chunk.toString('utf8'));
        pushHeartbeat(true);
    });

    child.on('exit', async (code, signal) => {
        output.write(`\n[${new Date().toISOString()}] Finished with code=${code} signal=${signal || ''}\n`);
        output.end();
        fs.rmSync(lockPath, { force: true });
        const finishedAt = new Date().toISOString();
        const success = (code || 0) === 0;

        const reportSummary = success ? readLatestSeoReport(repoRoot) : null;

        await updateAutomationStatus({
            ...statusBase,
            status: success ? 'Done' : 'Failed',
            currentStep: success ? 'Automation completed' : 'Automation failed',
            message: success
                ? 'Daily printer SEO run finished and handed off.'
                : `Local Codex runner exited with code ${code || 0}${signal ? ` (${signal})` : ''}.`,
            liveLogExcerpt: logBuffer.lines.slice(-10).join('\n'),
            lastMessageExcerpt: readFileIfExists(lastMessageFile),
            finishedAt,
            updatedAt: finishedAt,
            lastSuccessAt: success ? finishedAt : undefined,
            lastFailureAt: success ? undefined : finishedAt,
            queueStatus: reportSummary?.queueStatus || undefined,
            latestReportGeneratedAt: reportSummary?.latestReportGeneratedAt || undefined,
            completedTasks: reportSummary?.completedTasks || undefined
        }).catch(() => {});
        process.exit(code || 0);
    });

    child.on('error', async (error) => {
        output.write(`\n[${new Date().toISOString()}] Spawn error: ${error.message}\n`);
        output.end();
        fs.rmSync(lockPath, { force: true });
        const failedAt = new Date().toISOString();

        await updateAutomationStatus({
            ...statusBase,
            status: 'Failed',
            currentStep: 'Unable to spawn Codex CLI',
            message: error.message,
            finishedAt: failedAt,
            updatedAt: failedAt,
            lastFailureAt: failedAt
        }).catch(() => {});
        process.exit(1);
    });

    child.stdin.write(prompt);
    child.stdin.end();
}

try {
    main();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
}
