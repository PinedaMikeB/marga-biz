const fs = require('fs');
const path = require('path');

const CONFIG = {
    telegramApiBase: 'https://api.telegram.org',
    repoRoot: path.join(__dirname, '../..')
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
    loadEnvFile(path.join(CONFIG.repoRoot, '.env.local'));
    loadEnvFile(path.join(CONFIG.repoRoot, '.env'));
}

function getRequiredEnv(name) {
    loadLocalEnv();

    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing ${name}. Add it to .env.local first.`);
    }

    return value;
}

function buildLabeledError(label, message, cause = null) {
    const error = new Error(`${label}: ${message}`);
    if (cause) {
        error.cause = cause;
    }
    return error;
}

async function telegramRequest(method, payload = {}, requestMethod = 'POST', label = null) {
    const token = getRequiredEnv('TELEGRAM_BOT_TOKEN');
    const url = `${CONFIG.telegramApiBase}/bot${token}/${method}`;
    const requestLabel = label || `Telegram ${method}`;

    let response;
    try {
        response = await fetch(url, {
            method: requestMethod,
            headers: {
                'Content-Type': 'application/json'
            },
            body: requestMethod === 'POST' ? JSON.stringify(payload) : undefined
        });
    } catch (error) {
        throw buildLabeledError(requestLabel, 'fetch failed', error);
    }

    let data;
    try {
        data = await response.json();
    } catch (error) {
        throw buildLabeledError(requestLabel, `invalid JSON response (${response.status})`, error);
    }

    if (!response.ok || !data.ok) {
        throw buildLabeledError(requestLabel, data.description || `Telegram API error (${response.status})`);
    }

    return data.result;
}

async function sendMessage(text, options = {}) {
    const chatId = options.chatId || getRequiredEnv('TELEGRAM_CHAT_ID');
    return telegramRequest('sendMessage', {
        chat_id: chatId,
        text
    }, 'POST', options.label || 'Telegram sendMessage');
}

module.exports = {
    loadLocalEnv,
    getRequiredEnv,
    telegramRequest,
    sendMessage
};
