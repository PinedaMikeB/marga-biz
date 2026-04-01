#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync, spawnSync } = require('child_process');
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

function maybeCreateSmtpTransport() {
    let nodemailer;
    try {
        nodemailer = require('nodemailer');
    } catch {
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

function listMailAccounts() {
    const result = spawnSync('osascript', ['-e', 'tell application "Mail" to get name of every account'], {
        encoding: 'utf8'
    });

    if (result.status !== 0) {
        throw new Error((result.stderr || result.stdout || 'Mail account lookup failed').trim());
    }

    const output = (result.stdout || '').trim();
    return output ? output.split(/,\s*/).filter(Boolean) : [];
}

function escapeAppleScript(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function sendViaMailApp({ to, subject, body }) {
    if (process.platform !== 'darwin') {
        throw new Error('Mail app fallback is only available on macOS');
    }

    const accounts = listMailAccounts();
    if (!accounts.length) {
        throw new Error('No Apple Mail accounts are configured');
    }

    const tempFile = path.join(os.tmpdir(), `codex-email-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, body, 'utf8');

    try {
        const script = `
set bodyFile to POSIX file "${escapeAppleScript(tempFile)}"
set bodyText to read bodyFile
tell application "Mail"
    set newMessage to make new outgoing message with properties {visible:false, subject:"${escapeAppleScript(subject)}", content:bodyText & return & return}
    tell newMessage
        make new to recipient at end of to recipients with properties {address:"${escapeAppleScript(to)}"}
        send
    end tell
end tell
`;

        execFileSync('osascript', ['-e', script], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });

        return {
            method: 'mail-app',
            messageId: null,
            account: accounts[0]
        };
    } finally {
        fs.rmSync(tempFile, { force: true });
    }
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
        let mailAccounts = [];

        try {
            mailAccounts = listMailAccounts();
        } catch {
            mailAccounts = [];
        }

        process.stdout.write(JSON.stringify({
            ok: true,
            dryRun: true,
            to,
            subject,
            smtpReady,
            mailAccounts
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

    try {
        const result = sendViaMailApp({ to, subject, body });
        process.stdout.write(JSON.stringify({ ok: true, to, subject, ...result }, null, 2));
        process.stdout.write('\n');
        return;
    } catch (error) {
        errors.push(`mail-app: ${error.message}`);
    }

    throw new Error(`Email send failed. ${errors.join(' | ')}`);
}

main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
});
