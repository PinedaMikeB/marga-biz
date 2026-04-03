const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
    telegramApiBase: 'https://api.telegram.org',
    repoRoot: path.join(__dirname, '../..')
};
const TELEGRAM_SAFE_CHUNK_SIZE = 3500;

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
    const sharedEnvDir = path.join(os.homedir(), '.codex', 'env');
    const sharedEnvFile = path.join(sharedEnvDir, 'marga-biz.env');
    const sharedLocalEnvFile = path.join(sharedEnvDir, 'marga-biz.local.env');

    loadEnvFile(sharedEnvFile);
    loadEnvFile(sharedLocalEnvFile);
    loadEnvFile(path.join(CONFIG.repoRoot, '.env.local'));
    loadEnvFile(path.join(CONFIG.repoRoot, '.env'));

    try {
        const commonDir = execSync('git rev-parse --path-format=absolute --git-common-dir', {
            cwd: CONFIG.repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();

        const commonRepoRoot = path.dirname(commonDir);
        if (commonRepoRoot && commonRepoRoot !== CONFIG.repoRoot) {
            loadEnvFile(path.join(commonRepoRoot, '.env.local'));
            loadEnvFile(path.join(commonRepoRoot, '.env'));
        }
    } catch {
        // Ignore git discovery failures and continue with local env only.
    }
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
    const chunks = splitTelegramMessage(String(text || ''));
    const messageIds = [];
    let lastResult = null;

    for (let index = 0; index < chunks.length; index += 1) {
        const chunkText = chunks.length === 1
            ? chunks[index]
            : `[${index + 1}/${chunks.length}]\n${chunks[index]}`;

        lastResult = await telegramRequest('sendMessage', {
            chat_id: chatId,
            text: chunkText
        }, 'POST', options.label || 'Telegram sendMessage');

        messageIds.push(lastResult.message_id);
    }

    if (lastResult && messageIds.length > 1) {
        lastResult.message_ids = messageIds;
        lastResult.chunk_count = messageIds.length;
    }

    return lastResult;
}

function splitTelegramMessage(text) {
    if (text.length <= TELEGRAM_SAFE_CHUNK_SIZE) {
        return [text];
    }

    const chunks = [];
    const lines = text.split(/\r?\n/);
    let current = '';

    for (const line of lines) {
        const next = current ? `${current}\n${line}` : line;

        if (next.length <= TELEGRAM_SAFE_CHUNK_SIZE) {
            current = next;
            continue;
        }

        if (current) {
            chunks.push(current);
            current = '';
        }

        if (line.length <= TELEGRAM_SAFE_CHUNK_SIZE) {
            current = line;
            continue;
        }

        for (let offset = 0; offset < line.length; offset += TELEGRAM_SAFE_CHUNK_SIZE) {
            chunks.push(line.slice(offset, offset + TELEGRAM_SAFE_CHUNK_SIZE));
        }
    }

    if (current) {
        chunks.push(current);
    }

    return chunks.length ? chunks : [''];
}

module.exports = {
    loadLocalEnv,
    getRequiredEnv,
    telegramRequest,
    sendMessage
};
