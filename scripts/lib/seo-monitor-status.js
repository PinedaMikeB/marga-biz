const { loadLocalEnv } = require('./telegram-gateway');

const DEFAULT_SITE_ORIGIN = 'https://marga.biz';
const DEFAULT_ENDPOINT = '/.netlify/functions/seo-monitor-actions';

function getSiteOrigin() {
    loadLocalEnv();
    return process.env.SEO_MONITOR_SITE_ORIGIN
        || process.env.SITE_ORIGIN
        || process.env.URL
        || DEFAULT_SITE_ORIGIN;
}

function clipText(value, maxLength = 1000) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
}

async function postSeoMonitorAction(action, payload = {}) {
    const response = await fetch(`${getSiteOrigin()}${DEFAULT_ENDPOINT}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action,
            ...payload
        })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
        throw new Error(data.error || `SEO monitor action failed: ${response.status}`);
    }

    return data.data || data;
}

async function updateAutomationStatus(payload = {}) {
    return postSeoMonitorAction('update_automation_status', {
        ...payload,
        message: clipText(payload.message, 700),
        liveLogExcerpt: clipText(payload.liveLogExcerpt, 1800),
        lastMessageExcerpt: clipText(payload.lastMessageExcerpt, 1400)
    });
}

module.exports = {
    clipText,
    updateAutomationStatus
};
