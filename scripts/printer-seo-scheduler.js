#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { updateAutomationStatus } = require('./lib/seo-monitor-status');

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

function getNextRunAt(timeZone, targetHour, targetMinute, currentMinutes) {
    const targetToday = (targetHour * 60) + targetMinute;
    const next = new Date();
    if (currentMinutes >= targetToday) {
        next.setUTCDate(next.getUTCDate() + 1);
    }

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(next);
    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }

    return `${values.year}-${values.month}-${values.day}T${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}:00+08:00`;
}

async function main() {
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
    const nextRunAt = getNextRunAt(timeZone, targetHour, targetMinute, currentMinutes);
    const statusBase = {
        automationId: 'printer-seo-daily',
        name: 'Printer SEO Daily',
        source: 'launchd',
        runner: 'codex-cli',
        mode: 'local-launchd',
        timezone: timeZone,
        targetHour,
        targetMinute,
        nextRunAt,
        updatedAt: new Date().toISOString()
    };

    if (currentMinutes < targetMinutes) {
        await updateAutomationStatus({
            ...statusBase,
            status: 'Scheduled',
            currentStep: 'Waiting for daily window',
            message: `Waiting for ${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')} ${timeZone}.`
        }).catch(() => {});
        process.stdout.write(`Not time yet for ${timeZone} daily run.\n`);
        return;
    }

    const lastSuccess = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8').trim() : '';
    if (lastSuccess === parts.date) {
        await updateAutomationStatus({
            ...statusBase,
            status: 'Done',
            currentStep: 'Completed for today',
            message: `Automation already completed for ${parts.date}.`,
            lastSuccessAt: `${parts.date}T23:59:00+08:00`
        }).catch(() => {});
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
        await updateAutomationStatus({
            ...statusBase,
            status: 'Done',
            currentStep: 'Completed for today',
            message: `Printer SEO runner completed for ${parts.date}.`,
            lastSuccessAt: new Date().toISOString()
        }).catch(() => {});
        process.stdout.write(`Printer SEO runner completed for ${parts.date} ${timeZone}.\n`);
        return;
    }

    const message = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    fs.writeFileSync(failureFile, `${parts.date}\n${message}\n`, 'utf8');
    await updateAutomationStatus({
        ...statusBase,
        status: 'Failed',
        currentStep: 'Runner exited with an error',
        message,
        lastFailureAt: new Date().toISOString()
    }).catch(() => {});
    process.stderr.write(`${message}\n`);
    process.exit(result.status || 1);
}

try {
    main();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
}
