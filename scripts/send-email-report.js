#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createRequire } = require('module');
const { loadLocalEnv } = require('./lib/telegram-gateway');

const REPO_ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
    const [, , ...rest] = argv;
    const options = {};

    for (const arg of rest) {
        if (!arg.startsWith('--')) continue;
        const separator = arg.indexOf('=');
        if (separator === -1) {
            options[arg.slice(2)] = true;
            continue;
        }

        options[arg.slice(2, separator)] = arg.slice(separator + 1);
    }

    return options;
}

function resolveBody(options) {
    if (options.text) {
        return options.text;
    }

    if (options['body-file']) {
        const bodyPath = path.isAbsolute(options['body-file'])
            ? options['body-file']
            : path.join(REPO_ROOT, options['body-file']);
        return fs.readFileSync(bodyPath, 'utf8');
    }

    throw new Error('Missing email body. Pass --text="..." or --body-file=...');
}

function getGitEmailFallback() {
    try {
        return execSync('git config --get user.email', {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch {
        return '';
    }
}

function getRecipient(options) {
    return options.to
        || process.env.SEO_REPORT_EMAIL_TO
        || process.env.REPORT_EMAIL_TO
        || process.env.EMAIL_TO
        || getGitEmailFallback();
}

function getSubject(options) {
    return options.subject || `SEO Automation Report ${new Date().toISOString()}`;
}

function getGitCommonDir() {
    try {
        return execSync('git rev-parse --path-format=absolute --git-common-dir', {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch {
        return '';
    }
}

function loadNodemailer() {
    try {
        return require('nodemailer');
    } catch {}

    const commonDir = getGitCommonDir();
    if (commonDir) {
        const repoRootFromCommonDir = path.dirname(commonDir);
        const packageJson = path.join(repoRootFromCommonDir, 'package.json');
        if (fs.existsSync(packageJson)) {
            try {
                const repoRequire = createRequire(packageJson);
                return repoRequire('nodemailer');
            } catch {}
        }
    }

    return null;
}

function maybeCreateSmtpTransport() {
    const nodemailer = loadNodemailer();
    if (!nodemailer) {
        return null;
    }

    const url = process.env.SMTP_URL || process.env.EMAIL_SMTP_URL || process.env.MAIL_SMTP_URL;
    if (url) {
        return nodemailer.createTransport(url);
    }

    const host = process.env.SMTP_HOST || process.env.EMAIL_SMTP_HOST || process.env.MAIL_SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SMTP_PORT || process.env.MAIL_SMTP_PORT || 587);
    const user = process.env.SMTP_USER || process.env.EMAIL_SMTP_USER || process.env.MAIL_SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_SMTP_PASS || process.env.MAIL_SMTP_PASS;

    if (!host || !user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
    });
}

async function sendViaSmtp({ to, subject, body }) {
    const transport = maybeCreateSmtpTransport();
    if (!transport) {
        throw new Error('SMTP is not configured');
    }

    await transport.verify();

    const from = process.env.EMAIL_FROM
        || process.env.SMTP_FROM
        || process.env.REPORT_EMAIL_FROM
        || process.env.SMTP_USER
        || process.env.EMAIL_SMTP_USER
        || process.env.MAIL_SMTP_USER;

    const result = await transport.sendMail({
        from,
        to,
        subject,
        text: body
    });

    return {
        method: 'smtp',
        messageId: result.messageId || null
    };
}

async function main() {
    loadLocalEnv();

    const options = parseArgs(process.argv);
    const to = getRecipient(options);
    if (!to) {
        throw new Error('Missing recipient. Pass --to=... or configure SEO_REPORT_EMAIL_TO / git user.email.');
    }

    const subject = getSubject(options);
    const body = resolveBody(options);

    if (options['dry-run']) {
        const smtpReady = Boolean(maybeCreateSmtpTransport());

        process.stdout.write(JSON.stringify({
            ok: true,
            dryRun: true,
            to,
            subject,
            smtpReady,
            delivery: 'smtp-only'
        }, null, 2));
        process.stdout.write('\n');
        return;
    }

    const errors = [];

    try {
        const result = await sendViaSmtp({ to, subject, body });
        process.stdout.write(JSON.stringify({ ok: true, to, subject, ...result }, null, 2));
        process.stdout.write('\n');
        return;
    } catch (error) {
        errors.push(`smtp: ${error.message}`);
    }

    throw new Error(`Email send failed. ${errors.join(' | ')}. Apple Mail fallback is disabled; configure SMTP in local automation env.`);
}

main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
});
