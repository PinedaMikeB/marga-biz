#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

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

function main() {
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
        '--search',
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
        throw new Error(`Printer SEO run already active: ${lockPath}`);
    }

    fs.writeFileSync(lockPath, `${process.pid}\n${new Date().toISOString()}\n`, 'utf8');

    const prompt = fs.readFileSync(promptFile, 'utf8');
    const output = fs.createWriteStream(runLog, { flags: 'a' });
    output.write(`[${new Date().toISOString()}] Starting printer SEO Codex run\n`);

    const child = spawn(command, args, {
        cwd: repoRoot,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    child.stdout.on('data', (chunk) => {
        output.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
        output.write(chunk);
    });

    child.on('exit', (code, signal) => {
        output.write(`\n[${new Date().toISOString()}] Finished with code=${code} signal=${signal || ''}\n`);
        output.end();
        fs.rmSync(lockPath, { force: true });
        process.exit(code || 0);
    });

    child.on('error', (error) => {
        output.write(`\n[${new Date().toISOString()}] Spawn error: ${error.message}\n`);
        output.end();
        fs.rmSync(lockPath, { force: true });
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
