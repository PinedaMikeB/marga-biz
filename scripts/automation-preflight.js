#!/usr/bin/env node

const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadLocalEnv, telegramRequest } = require('./lib/telegram-gateway');

const REPO_ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
    const options = {};

    for (const arg of argv.slice(2)) {
        if (!arg.startsWith('--')) {
            continue;
        }

        const separator = arg.indexOf('=');
        if (separator === -1) {
            options[arg.slice(2)] = true;
            continue;
        }

        options[arg.slice(2, separator)] = arg.slice(separator + 1);
    }

    return options;
}

function runCommand(command, args, extra = {}) {
    const result = spawnSync(command, args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout: extra.timeout || 30000,
        ...extra
    });

    if (result.error) {
        throw result.error;
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        const detail = (result.stderr || result.stdout || '').trim();
        throw new Error(detail || `${command} exited with status ${result.status}`);
    }

    return (result.stdout || '').trim();
}

function git(args, extra = {}) {
    return runCommand('git', args, extra);
}

function parseJsonOutput(command, args) {
    const output = runCommand(command, args);
    return output ? JSON.parse(output) : {};
}

async function checkDns(host) {
    const result = await dns.lookup(host);
    return {
        host,
        address: result.address,
        family: result.family
    };
}

function getGitContext() {
    const repoRoot = git(['rev-parse', '--show-toplevel']);
    const gitCommonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    const remotes = git(['remote', '-v']);
    return { repoRoot, gitCommonDir, branch, remotes };
}

function ensureGitCommonDirWritable(gitCommonDir) {
    const testFile = path.join(gitCommonDir, `.codex-preflight-${process.pid}-${Date.now()}`);
    fs.writeFileSync(testFile, 'ok\n', 'utf8');
    fs.rmSync(testFile, { force: true });
    return { gitCommonDir };
}

function ensureCleanWorktree() {
    const status = git(['status', '--porcelain']);
    if (status) {
        throw new Error(`Worktree is not clean:\n${status}`);
    }

    return {
        clean: true,
        status: ''
    };
}

function checkEnvVisibility() {
    loadLocalEnv();

    const env = {
        telegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        telegramChatId: Boolean(process.env.TELEGRAM_CHAT_ID),
        netlifyAuthToken: Boolean(process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN),
        netlifySiteId: Boolean(process.env.NETLIFY_SITE_ID),
        reportEmailTo: Boolean(process.env.SEO_REPORT_EMAIL_TO || process.env.REPORT_EMAIL_TO || process.env.EMAIL_TO),
        googleServiceAccountKey: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
        serperApiKey: Boolean(process.env.SERPER_API_KEY),
        smtpHost: process.env.SMTP_HOST || process.env.EMAIL_SMTP_HOST || process.env.MAIL_SMTP_HOST || null,
        smtpUser: Boolean(process.env.SMTP_USER || process.env.EMAIL_SMTP_USER || process.env.MAIL_SMTP_USER)
    };

    const missing = Object.entries(env)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missing.length) {
        throw new Error(`Missing automation env values: ${missing.join(', ')}`);
    }

    return env;
}

function checkInstalledDependencies() {
    const modules = ['firebase-admin', 'googleapis', 'nodemailer'];
    const resolved = {};

    for (const moduleName of modules) {
        try {
            resolved[moduleName] = require.resolve(moduleName, {
                paths: [REPO_ROOT]
            });
        } catch {
            throw new Error(`Missing installed dependency for automation runtime: ${moduleName}`);
        }
    }

    return resolved;
}

function ensureOriginReachable() {
    const head = git(['ls-remote', '--exit-code', 'origin', 'HEAD'], { timeout: 45000 });
    return { head };
}

function ensureWorktreeSynced() {
    git(['fetch', 'origin', 'main'], { timeout: 60000 });
    const currentHead = git(['rev-parse', 'HEAD']);
    const upstreamHead = git(['rev-parse', 'origin/main']);

    if (currentHead !== upstreamHead) {
        git(['merge', '--ff-only', 'origin/main'], { timeout: 60000 });
    }

    return {
        currentHead: git(['rev-parse', 'HEAD']),
        upstreamHead
    };
}

function checkDeployDryRun() {
    return parseJsonOutput('node', ['scripts/deploy-site.js', '--dry-run']);
}

function checkEmailDryRun() {
    return parseJsonOutput('node', [
        'scripts/send-email-report.js',
        '--dry-run',
        '--subject=Codex automation preflight',
        '--text=preflight'
    ]);
}

async function checkTelegram() {
    loadLocalEnv();

    const env = {
        telegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        telegramChatId: Boolean(process.env.TELEGRAM_CHAT_ID)
    };

    if (!env.telegramBotToken || !env.telegramChatId) {
        throw new Error('Telegram env is incomplete');
    }

    const me = await telegramRequest('getMe', {}, 'GET', 'Telegram getMe');
    return {
        ...env,
        username: me.username || null
    };
}

async function run() {
    const options = parseArgs(process.argv);
    const strict = Boolean(options.strict);
    const syncMain = Boolean(options['sync-main']);
    const results = [];

    async function addCheck(name, fn) {
        try {
            const detail = await fn();
            results.push({ name, ok: true, detail });
        } catch (error) {
            results.push({ name, ok: false, error: error.message });
        }
    }

    const gitContext = getGitContext();

    await addCheck('gitContext', async () => gitContext);
    await addCheck('gitCommonDirWritable', async () => ensureGitCommonDirWritable(gitContext.gitCommonDir));
    await addCheck('worktreeStatus', async () => ensureCleanWorktree());
    await addCheck('envVisibility', async () => checkEnvVisibility());
    await addCheck('installedDependencies', async () => checkInstalledDependencies());
    await addCheck('dnsGithub', async () => checkDns('github.com'));
    await addCheck('dnsSite', async () => checkDns('marga.biz'));
    await addCheck('dnsTelegram', async () => checkDns('api.telegram.org'));
    await addCheck('dnsSmtp', async () => checkDns('smtp.hostinger.com'));
    await addCheck('originReachable', async () => ensureOriginReachable());

    if (syncMain) {
        await addCheck('syncMain', async () => ensureWorktreeSynced());
    }

    await addCheck('deployDryRun', async () => checkDeployDryRun());
    await addCheck('emailDryRun', async () => checkEmailDryRun());
    await addCheck('telegram', async () => checkTelegram());

    const summary = {
        ok: results.every((entry) => entry.ok),
        strict,
        syncMain,
        repoRoot: REPO_ROOT,
        results
    };

    process.stdout.write(JSON.stringify(summary, null, 2));
    process.stdout.write('\n');

    if (strict && !summary.ok) {
        process.exit(1);
    }
}

run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
});
