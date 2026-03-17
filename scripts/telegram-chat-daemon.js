/**
 * Simple Telegram chat daemon for near-real-time bot replies.
 *
 * Behavior:
 * - polls Telegram for new messages and callback queries
 * - records inbound messages and approval callbacks
 * - replies once per new plain-text message
 *
 * Usage:
 *   node scripts/telegram-chat-daemon.js
 *   node scripts/telegram-chat-daemon.js --interval=5
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
    telegramApiBase: 'https://api.telegram.org',
    repoRoot: path.join(__dirname, '..'),
    tempDir: path.join(__dirname, '../temp'),
    offsetFile: path.join(__dirname, '../temp/telegram-update-offset.json'),
    decisionsFile: path.join(__dirname, '../temp/telegram-approvals.json'),
    messagesFile: path.join(__dirname, '../temp/telegram-messages.json'),
    inboxReportFile: path.join(__dirname, '../reports/telegram-bridge/inbox.md'),
    daemonStateFile: path.join(__dirname, '../temp/telegram-chat-daemon-state.json')
};

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();

        if (!key || process.env[key]) continue;

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

function readJson(filePath, fallback) {
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
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function dedupeBy(messages, keyBuilder) {
    const seen = new Set();
    const unique = [];

    for (const item of messages) {
        const key = keyBuilder(item);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
    }

    return unique;
}

function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing ${name}. Add it to .env.local first.`);
    }
    return value;
}

async function telegramRequest(method, payload = {}, requestMethod = 'POST') {
    const token = getRequiredEnv('TELEGRAM_BOT_TOKEN');
    const url = `${CONFIG.telegramApiBase}/bot${token}/${method}`;

    const response = await fetch(url, {
        method: requestMethod,
        headers: {
            'Content-Type': 'application/json'
        },
        body: requestMethod === 'POST' ? JSON.stringify(payload) : undefined
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
        throw new Error(data.description || `Telegram API error (${response.status})`);
    }

    return data.result;
}

function writeInboxReport(messages) {
    ensureDir(path.dirname(CONFIG.inboxReportFile));

    const lines = [
        '# Telegram Inbox',
        '',
        `Updated: ${new Date().toISOString()}`,
        ''
    ];

    const recent = messages.slice(-20).reverse();

    if (!recent.length) {
        lines.push('No Telegram messages captured yet.');
    } else {
        for (const message of recent) {
            lines.push(`- ${message.receivedAt} | ${message.user} | ${message.text}`);
        }
    }

    fs.writeFileSync(CONFIG.inboxReportFile, lines.join('\n'));
}

async function answerCallback(callbackQueryId, text) {
    try {
        await telegramRequest('answerCallbackQuery', {
            callback_query_id: callbackQueryId,
            text
        });
    } catch (error) {
        process.stderr.write(`Callback acknowledgement skipped: ${error.message}\n`);
    }
}

function buildReplyText(message) {
    const shortText = message.text.length > 140 ? `${message.text.slice(0, 137)}...` : message.text;
    return `Received in Codex: "${shortText}"`;
}

async function sendReply(chatId, text) {
    await telegramRequest('sendMessage', {
        chat_id: chatId,
        text
    });
}

async function pollOnce() {
    const offsetState = readJson(CONFIG.offsetFile, { updateOffset: 0 });
    const daemonState = readJson(CONFIG.daemonStateFile, { repliedMessageIds: [] });
    const decisions = readJson(CONFIG.decisionsFile, []);
    const messages = readJson(CONFIG.messagesFile, []);

    const updates = await telegramRequest('getUpdates', {
        offset: offsetState.updateOffset,
        allowed_updates: ['callback_query', 'message']
    });

    if (!updates.length) {
        return { messageCount: 0, replyCount: 0, approvalCount: 0 };
    }

    let highestUpdateId = offsetState.updateOffset;
    const recordedMessages = [...messages];
    const recordedDecisions = [...decisions];
    const repliedMessageIds = new Set(daemonState.repliedMessageIds || []);
    let messageCount = 0;
    let replyCount = 0;
    let approvalCount = 0;

    for (const update of updates) {
        highestUpdateId = Math.max(highestUpdateId, update.update_id + 1);

        const message = update.message;
        if (message?.text && !message.from?.is_bot) {
            const entry = {
                chatId: message.chat?.id || null,
                messageId: message.message_id || null,
                text: message.text,
                user: message.from?.username || message.from?.first_name || 'unknown',
                receivedAt: new Date().toISOString()
            };

            recordedMessages.push(entry);
            messageCount += 1;

            if (!repliedMessageIds.has(entry.messageId) && !entry.text.startsWith('/')) {
                await sendReply(entry.chatId, buildReplyText(entry));
                repliedMessageIds.add(entry.messageId);
                replyCount += 1;
            }
        }

        const callback = update.callback_query;
        if (callback?.data) {
            const [decision, approvalId] = callback.data.split(':');
            if (decision && approvalId) {
                recordedDecisions.push({
                    approvalId,
                    decision,
                    chatId: callback.message?.chat?.id || null,
                    user: callback.from?.username || callback.from?.first_name || 'unknown',
                    decidedAt: new Date().toISOString(),
                    messageId: callback.message?.message_id || null
                });
                await answerCallback(callback.id, `Recorded: ${decision}`);
                approvalCount += 1;
            }
        }
    }

    writeJson(CONFIG.offsetFile, { updateOffset: highestUpdateId });
    writeJson(
        CONFIG.messagesFile,
        dedupeBy(recordedMessages, item => [item.chatId, item.messageId, item.text].join('|'))
    );
    writeJson(
        CONFIG.decisionsFile,
        dedupeBy(recordedDecisions, item => [item.approvalId, item.decision, item.chatId, item.messageId, item.user].join('|'))
    );
    writeJson(CONFIG.daemonStateFile, {
        repliedMessageIds: Array.from(repliedMessageIds).slice(-200)
    });
    writeInboxReport(readJson(CONFIG.messagesFile, []));

    return { messageCount, replyCount, approvalCount };
}

async function main() {
    loadLocalEnv();

    const arg = process.argv.slice(2).find(item => item.startsWith('--interval='));
    const intervalSeconds = arg ? Number(arg.split('=')[1]) : 5;

    if (!Number.isFinite(intervalSeconds) || intervalSeconds < 2) {
        throw new Error('Interval must be a number >= 2 seconds.');
    }

    process.stdout.write(`Telegram chat daemon started. Poll interval: ${intervalSeconds}s\n`);

    while (true) {
        try {
            const result = await pollOnce();
            if (result.messageCount || result.replyCount || result.approvalCount) {
                process.stdout.write(
                    `[${new Date().toISOString()}] messages=${result.messageCount} replies=${result.replyCount} approvals=${result.approvalCount}\n`
                );
            }
        } catch (error) {
            process.stderr.write(`[${new Date().toISOString()}] ${error.message}\n`);
        }

        await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
