/**
 * Telegram approval helper for morning SEO reviews.
 *
 * Commands:
 *   node scripts/telegram-approval.js bot-info
 *   node scripts/telegram-approval.js discover-chat
 *   node scripts/telegram-approval.js send-review --approval-id=seo-2026-03-16 --title="SEO Review" --body-file=reports/location-seo-tracker.md
 *   node scripts/telegram-approval.js check-approvals
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
    telegramApiBase: 'https://api.telegram.org',
    repoRoot: path.join(__dirname, '..'),
    tempDir: path.join(__dirname, '../temp'),
    offsetFile: path.join(__dirname, '../temp/telegram-update-offset.json'),
    decisionsFile: path.join(__dirname, '../temp/telegram-approvals.json')
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

function parseArgs(argv) {
    const [command = 'help', ...rest] = argv;
    const options = {};

    for (const arg of rest) {
        if (!arg.startsWith('--')) continue;
        const separatorIndex = arg.indexOf('=');
        if (separatorIndex === -1) {
            options[arg.slice(2)] = true;
            continue;
        }
        options[arg.slice(2, separatorIndex)] = arg.slice(separatorIndex + 1);
    }

    return { command, options };
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

function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing ${name}. Add it to .env.local first.`);
    }
    return value;
}

async function telegramRequest(method, payload = {}, requestMethod = 'POST') {
    loadLocalEnv();

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

async function botInfo() {
    const info = await telegramRequest('getMe');
    process.stdout.write(`Bot: @${info.username}\n`);
    process.stdout.write(`Name: ${info.first_name}\n`);
    process.stdout.write(`Bot ID: ${info.id}\n`);
}

async function discoverChat() {
    const offsetState = readJson(CONFIG.offsetFile, { updateOffset: 0 });
    const updates = await telegramRequest('getUpdates', {
        offset: offsetState.updateOffset,
        allowed_updates: ['message', 'callback_query']
    });

    if (!updates.length) {
        process.stdout.write('No Telegram updates found yet.\n');
        process.stdout.write('Send a message like /start to your bot, then run discover-chat again.\n');
        return;
    }

    const chats = new Map();
    let highestUpdateId = offsetState.updateOffset;

    for (const update of updates) {
        highestUpdateId = Math.max(highestUpdateId, update.update_id + 1);

        const chat = update.message?.chat || update.callback_query?.message?.chat;
        const user = update.message?.from || update.callback_query?.from;

        if (!chat) continue;

        chats.set(chat.id, {
            chatId: chat.id,
            type: chat.type,
            title: chat.title || '',
            username: user?.username || '',
            firstName: user?.first_name || '',
            lastMessage: update.message?.text || update.callback_query?.data || ''
        });
    }

    writeJson(CONFIG.offsetFile, { updateOffset: highestUpdateId });

    const found = Array.from(chats.values());
    writeJson(path.join(CONFIG.tempDir, 'telegram-chats.json'), found);

    for (const chat of found) {
        process.stdout.write(
            `Chat ID: ${chat.chatId} | type: ${chat.type} | user: ${chat.username || chat.firstName || 'unknown'} | last: ${chat.lastMessage}\n`
        );
    }
}

function buildApprovalMessage(title, bodyText, approvalId) {
    const trimmedBody = bodyText.length > 3000 ? `${bodyText.slice(0, 2997)}...` : bodyText;
    return [
        `*${title}*`,
        '',
        trimmedBody,
        '',
        `Approval ID: \`${approvalId}\``,
        '',
        'Choose an action below.'
    ].join('\n');
}

async function sendReview(options) {
    const chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
        throw new Error('Missing TELEGRAM_CHAT_ID. Discover the chat first or pass --chatId=...');
    }

    const approvalId = options.approvalId || `approval-${Date.now()}`;
    const title = options.title || 'SEO Review';
    const bodyFile = options['body-file'];
    const bodyText = bodyFile
        ? fs.readFileSync(path.join(CONFIG.repoRoot, bodyFile), 'utf8')
        : (options.body || 'No review body provided.');

    const messageText = buildApprovalMessage(title, bodyText, approvalId);

    const result = await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: messageText,
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Approve', callback_data: `approve:${approvalId}` },
                    { text: 'Reject', callback_data: `reject:${approvalId}` }
                ]
            ]
        }
    });

    process.stdout.write(`Sent approval request ${approvalId} to chat ${chatId}.\n`);
    process.stdout.write(`Message ID: ${result.message_id}\n`);
}

async function answerCallback(callbackQueryId, text) {
    await telegramRequest('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text
    });
}

async function checkApprovals() {
    const offsetState = readJson(CONFIG.offsetFile, { updateOffset: 0 });
    const decisions = readJson(CONFIG.decisionsFile, []);
    const updates = await telegramRequest('getUpdates', {
        offset: offsetState.updateOffset,
        allowed_updates: ['callback_query', 'message']
    });

    if (!updates.length) {
        process.stdout.write('No new approval updates.\n');
        return;
    }

    let highestUpdateId = offsetState.updateOffset;
    const recorded = [...decisions];

    for (const update of updates) {
        highestUpdateId = Math.max(highestUpdateId, update.update_id + 1);

        const callback = update.callback_query;
        if (!callback || !callback.data) {
            continue;
        }

        const [decision, approvalId] = callback.data.split(':');
        if (!decision || !approvalId) {
            continue;
        }

        const entry = {
            approvalId,
            decision,
            chatId: callback.message?.chat?.id || null,
            user: callback.from?.username || callback.from?.first_name || 'unknown',
            decidedAt: new Date().toISOString(),
            messageId: callback.message?.message_id || null
        };

        recorded.push(entry);
        await answerCallback(callback.id, `Recorded: ${decision}`);
        process.stdout.write(`Approval ${approvalId}: ${decision} by ${entry.user}\n`);
    }

    writeJson(CONFIG.offsetFile, { updateOffset: highestUpdateId });
    writeJson(CONFIG.decisionsFile, recorded);
}

function printHelp() {
    process.stdout.write(
        [
            'Commands:',
            '  node scripts/telegram-approval.js bot-info',
            '  node scripts/telegram-approval.js discover-chat',
            '  node scripts/telegram-approval.js send-review --approval-id=seo-2026-03-16 --title="SEO Review" --body-file=reports/location-seo-tracker.md',
            '  node scripts/telegram-approval.js check-approvals'
        ].join('\n') + '\n'
    );
}

async function main() {
    const { command, options } = parseArgs(process.argv.slice(2));

    switch (command) {
        case 'bot-info':
            await botInfo();
            break;
        case 'discover-chat':
            await discoverChat();
            break;
        case 'send-review':
            await sendReview(options);
            break;
        case 'check-approvals':
            await checkApprovals();
            break;
        default:
            printHelp();
            break;
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
