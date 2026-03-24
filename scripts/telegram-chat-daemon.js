/**
 * Simple Telegram chat daemon for near-real-time bot replies.
 *
 * Behavior:
 * - polls Telegram for new messages and callback queries
 * - records inbound messages and approval callbacks
 * - replies once per new text or captioned-media message
 *
 * Usage:
 *   node scripts/telegram-chat-daemon.js
 *   node scripts/telegram-chat-daemon.js --interval=5
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const CONFIG = {
    telegramApiBase: 'https://api.telegram.org',
    repoRoot: path.join(__dirname, '..'),
    codexBinary: process.env.CODEX_BIN || '/Applications/Codex.app/Contents/Resources/codex',
    tempDir: path.join(__dirname, '../temp'),
    lockFile: path.join(__dirname, '../temp/telegram-chat-daemon.lock'),
    offsetFile: path.join(__dirname, '../temp/telegram-update-offset.json'),
    decisionsFile: path.join(__dirname, '../temp/telegram-approvals.json'),
    messagesFile: path.join(__dirname, '../temp/telegram-messages.json'),
    inboxReportFile: path.join(__dirname, '../reports/telegram-bridge/inbox.md'),
    daemonStateFile: path.join(__dirname, '../temp/telegram-chat-daemon-state.json'),
    historyFile: path.join(__dirname, '../temp/telegram-chat-history.json')
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

function isPidRunning(pid) {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }

    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function acquireSingletonLock() {
    ensureDir(path.dirname(CONFIG.lockFile));

    if (fs.existsSync(CONFIG.lockFile)) {
        const existingPid = Number(fs.readFileSync(CONFIG.lockFile, 'utf8').trim());
        if (isPidRunning(existingPid)) {
            throw new Error(`Telegram daemon already running with pid ${existingPid}`);
        }

        fs.unlinkSync(CONFIG.lockFile);
    }

    fs.writeFileSync(CONFIG.lockFile, String(process.pid));
}

function releaseSingletonLock() {
    if (!fs.existsSync(CONFIG.lockFile)) {
        return;
    }

    const existingPid = Number(fs.readFileSync(CONFIG.lockFile, 'utf8').trim());
    if (existingPid === process.pid) {
        fs.unlinkSync(CONFIG.lockFile);
    }
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
            lines.push(`- ${message.receivedAt} | ${message.user} | ${message.text || message.displayText || '(no text)'}`);
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

function buildFallbackReply(message, error = null) {
    const normalized = String(message.text || '').trim().toLowerCase();

    if (!normalized && message.hasMedia) {
        return 'I received your attachment, but this Telegram bridge can only read the caption text right now. Add a caption or paste the key text here and I will answer directly.';
    }

    if (['hi', 'hello', 'hey', 'test', 'ping'].includes(normalized)) {
        return 'Hi. I can receive your Telegram messages now. Send me what you need and I will reply here.';
    }

    if (normalized.includes('can you receive') || normalized.includes('do you receive')) {
        return 'Yes. I can receive your Telegram messages now. Send your question here and I will answer directly.';
    }

    if (normalized.includes('can you reply') || normalized.includes('reply now') || normalized.includes('this is a test')) {
        return 'Yes. I can reply here now.';
    }

    if (error && String(error.message || '').includes('ETIMEDOUT')) {
        return 'Reply generation timed out on my side. Send a shorter message or retry and I will answer directly.';
    }

    return 'I hit a reply error on my side. Retry once and I will answer directly.';
}

async function sendReply(chatId, text) {
    await telegramRequest('sendMessage', {
        chat_id: chatId,
        text
    });
}

function recentHistoryFor(chatId, history) {
    return (history[String(chatId)] || []).slice(-4);
}

function describeIncomingMedia(message) {
    const media = [];

    if (Array.isArray(message.photo) && message.photo.length) media.push('photo');
    if (message.document) media.push('document');
    if (message.video) media.push('video');
    if (message.audio) media.push('audio');
    if (message.voice) media.push('voice message');
    if (message.animation) media.push('animation');

    return media.join(', ');
}

function buildIncomingEntry(message) {
    const text = typeof message.text === 'string'
        ? message.text.trim()
        : typeof message.caption === 'string'
            ? message.caption.trim()
            : '';
    const mediaSummary = describeIncomingMedia(message);

    return {
        chatId: message.chat?.id || null,
        messageId: message.message_id || null,
        text,
        displayText: text || (mediaSummary ? `[${mediaSummary} with no caption]` : '(no text)'),
        hasMedia: Boolean(mediaSummary),
        user: message.from?.username || message.from?.first_name || 'unknown',
        receivedAt: new Date().toISOString()
    };
}

function appendHistory(chatId, role, text, history) {
    const key = String(chatId);
    const updated = Array.isArray(history[key]) ? [...history[key]] : [];
    updated.push({
        role,
        text,
        timestamp: new Date().toISOString()
    });
    history[key] = updated.slice(-12);
}

function buildCodexPrompt(message, history) {
    const historyLines = history.length
        ? history.map(entry => `${entry.role}: ${entry.text}`).join('\n')
        : 'No prior chat history.';

    return [
        'You are Codex replying through a Telegram bot for Marga Enterprises.',
        'Answer the user directly as if you are replying inside the same Telegram chat.',
        'Match the same direct, concise style used in the Codex desktop thread.',
        'Keep the reply concise and practical.',
        'Prefer 2 to 5 short sentences.',
        'Use plain text only.',
        'When the user asks about SEO automation, stored instructions, latest reports, what changed today, or whether something already ran, do not rely on prior chat history alone.',
        'For those questions, verify the current files on disk before answering.',
        'Check these files first for SEO automation questions:',
        '- /Users/mike/.codex/automations/morning-seo-review/automation.toml',
        '- /Users/mike/.codex/automations/morning-seo-review/memory.md',
        '- reports/morning-seo-review/latest.md',
        '- reports/morning-seo-review/latest.json',
        '- reports/location-seo-tracker.md',
        'Prefer the newest timestamp you can verify from those files.',
        'If a prior assistant message in the chat history conflicts with the current files, trust the current files and say so plainly.',
        message.hasMedia
            ? 'The user attached media with this message. Only use the text or caption you were given. Do not claim to have inspected the attachment itself.'
            : 'No media was attached to this message.',
        'Do not mention internal tools, polling, daemon, bridge, queue, fallback behavior, or implementation details unless the user asks about them.',
        'Do not say "Received in Codex" or describe the handoff process.',
        'Do not add email-style sign-offs like "Best regards".',
        '',
        'Recent conversation:',
        historyLines,
        '',
        `Latest user message: ${message.text}`,
        '',
        'Reply now.'
    ].join('\n');
}

function generateReplyWithCodex(message, history) {
    const prompt = buildCodexPrompt(message, history);
    const outputFile = path.join(
        os.tmpdir(),
        `codex-telegram-reply-${Date.now()}-${message.messageId || 'msg'}.txt`
    );

    const result = spawnSync(
        CONFIG.codexBinary,
        [
            'exec',
            '--skip-git-repo-check',
            '--ephemeral',
            '--dangerously-bypass-approvals-and-sandbox',
            '--output-last-message',
            outputFile,
            '-'
        ],
        {
            cwd: CONFIG.repoRoot,
            encoding: 'utf8',
            input: prompt,
            timeout: 60000,
            maxBuffer: 1024 * 1024 * 8
        }
    );

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error((result.stderr || result.stdout || 'codex exec failed').trim());
    }

    if (!fs.existsSync(outputFile)) {
        throw new Error('codex exec completed without producing an output file');
    }

    const reply = fs.readFileSync(outputFile, 'utf8').trim();
    fs.unlinkSync(outputFile);

    if (!reply) {
        throw new Error('codex exec produced an empty reply');
    }

    return reply;
}

async function pollOnce() {
    const offsetState = readJson(CONFIG.offsetFile, { updateOffset: 0 });
    const daemonState = readJson(CONFIG.daemonStateFile, { repliedMessageIds: [] });
    const decisions = readJson(CONFIG.decisionsFile, []);
    const messages = readJson(CONFIG.messagesFile, []);
    const history = readJson(CONFIG.historyFile, {});

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
        if (message && !message.from?.is_bot) {
            const entry = buildIncomingEntry(message);
            if (!entry.text && !entry.hasMedia) {
                continue;
            }

            recordedMessages.push(entry);
            messageCount += 1;
            if (entry.text) {
                appendHistory(entry.chatId, 'user', entry.text, history);
            }

            if (!repliedMessageIds.has(entry.messageId) && !entry.text.startsWith('/')) {
                let replyText;

                if (!entry.text && entry.hasMedia) {
                    replyText = buildFallbackReply(entry);
                } else {
                    try {
                        replyText = generateReplyWithCodex(entry, recentHistoryFor(entry.chatId, history));
                    } catch (error) {
                        replyText = buildFallbackReply(entry, error);
                        process.stderr.write(`[${new Date().toISOString()}] codex reply failed: ${error.message}\n`);
                    }
                }

                await sendReply(entry.chatId, replyText);
                appendHistory(entry.chatId, 'assistant', replyText, history);
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
        dedupeBy(recordedMessages, item => [item.chatId, item.messageId, item.text || item.displayText].join('|'))
    );
    writeJson(
        CONFIG.decisionsFile,
        dedupeBy(recordedDecisions, item => [item.approvalId, item.decision, item.chatId, item.messageId, item.user].join('|'))
    );
    writeJson(CONFIG.daemonStateFile, {
        repliedMessageIds: Array.from(repliedMessageIds).slice(-200)
    });
    writeJson(CONFIG.historyFile, history);
    writeInboxReport(readJson(CONFIG.messagesFile, []));

    return { messageCount, replyCount, approvalCount };
}

async function main() {
    loadLocalEnv();
    acquireSingletonLock();

    const cleanup = () => releaseSingletonLock();
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
        cleanup();
        process.exit(130);
    });
    process.on('SIGTERM', () => {
        cleanup();
        process.exit(143);
    });

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
