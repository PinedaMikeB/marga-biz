#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function getTimeParts(timeZone) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(new Date());
    const values = {};

    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }

    return {
        date: `${values.year}-${values.month}-${values.day}`,
        hour: Number(values.hour),
        minute: Number(values.minute)
    };
}

function main() {
    const homeDir = os.homedir();
    const stateDir = process.env.PRINTER_SEO_STATE_DIR || path.join(homeDir, '.codex', 'automation-state');
    const runner = process.env.PRINTER_SEO_RUNNER || path.join(process.cwd(), 'scripts', 'run-printer-seo-daily.js');
    const timeZone = process.env.PRINTER_SEO_TIMEZONE || 'Asia/Manila';
    const targetHour = Number(process.env.PRINTER_SEO_TARGET_HOUR || '9');
    const targetMinute = Number(process.env.PRINTER_SEO_TARGET_MINUTE || '0');
    const stateFile = path.join(stateDir, 'printer-seo-daily-last-success.txt');
    const failureFile = path.join(stateDir, 'printer-seo-daily-last-failure.txt');
    const parts = getTimeParts(timeZone);

    ensureDir(stateDir);

    const targetMinutes = (targetHour * 60) + targetMinute;
    const currentMinutes = (parts.hour * 60) + parts.minute;

    if (currentMinutes < targetMinutes) {
        process.stdout.write(`Not time yet for ${timeZone} daily run.\n`);
        return;
    }

    const lastSuccess = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8').trim() : '';
    if (lastSuccess === parts.date) {
        process.stdout.write(`Already completed for ${parts.date} ${timeZone}.\n`);
        return;
    }

    const result = spawnSync(process.execPath, [runner], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: process.env,
        timeout: 1000 * 60 * 60 * 6
    });

    if (result.status === 0) {
        fs.writeFileSync(stateFile, `${parts.date}\n`, 'utf8');
        if (fs.existsSync(failureFile)) {
            fs.rmSync(failureFile, { force: true });
        }
        process.stdout.write(`Printer SEO runner completed for ${parts.date} ${timeZone}.\n`);
        return;
    }

    const message = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    fs.writeFileSync(failureFile, `${parts.date}\n${message}\n`, 'utf8');
    process.stderr.write(`${message}\n`);
    process.exit(result.status || 1);
}

try {
    main();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
}
