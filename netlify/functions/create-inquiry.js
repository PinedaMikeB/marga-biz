const { makeInquiryId, saveInquiry } = require('./lib/website-inquiries-store');

function clean(value) {
    return String(value || '').trim();
}

function normalizePhone(value) {
    const raw = clean(value);
    const digits = raw.replace(/[^\d+]/g, '');
    if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
    if (/^639\d{9}$/.test(digits)) return `+${digits}`;
    if (/^\+639\d{9}$/.test(digits)) return digits;
    return raw;
}

function parseBody(event) {
    const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
    if (!event.body) return {};

    if (contentType.includes('application/json')) {
        return JSON.parse(event.body);
    }

    const params = new URLSearchParams(event.body);
    return Object.fromEntries(params.entries());
}

async function notifyTelegram(lead) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const lines = [
        'New Marga website inquiry',
        `Name: ${lead.fullName || 'N/A'}`,
        `Company: ${lead.company || 'N/A'}`,
        `Mobile: ${lead.phone || 'N/A'}`,
        `Service: ${lead.service || 'N/A'}`,
        `Language: ${lead.languageMode}`,
        `Consent to call: ${lead.callConsent ? 'Yes' : 'No'}`,
        '',
        lead.message ? `Message: ${lead.message}` : 'Message: N/A'
    ];

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: lines.join('\n'),
            disable_web_page_preview: true
        })
    });
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const data = parseBody(event);
        const firstName = clean(data.firstName || data['first-name']);
        const lastName = clean(data.lastName || data['last-name']);
        const fullName = clean(data.fullName || `${firstName} ${lastName}`);
        const phone = normalizePhone(data.phone || data.mobile);
        const email = clean(data.email).toLowerCase();
        const company = clean(data.company);
        const service = clean(data.service);
        const message = clean(data.message);
        const callConsent = ['true', 'yes', 'on', '1'].includes(String(data.callConsent || data['call-consent'] || '').toLowerCase());
        const languageMode = clean(data.languageMode || data['language-mode'] || 'taglish').toLowerCase() === 'english'
            ? 'english'
            : 'taglish';
        const source = clean(data.source || 'marga.biz/contact');
        const consultationMode = clean(data.consultationMode || 'contact_form');
        const requestedWindow = clean(data.requestedWindow);
        const isBrowserConsultation = source.includes('ai-consultant') || consultationMode === 'talk_now' || consultationMode === 'schedule';

        if (!fullName || !phone || !email || !company || !service || !message) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing required inquiry fields' })
            };
        }

        const now = new Date().toISOString();
        const aiConsultantStatus = isBrowserConsultation
            ? (consultationMode === 'schedule' ? 'consultation_scheduled' : 'browser_voice_requested')
            : 'new_inquiry';
        const aiCallStatus = isBrowserConsultation
            ? 'browser_voice_requested'
            : (callConsent ? 'pending_call' : 'waiting_for_call_consent');
        const nextAction = isBrowserConsultation
            ? (consultationMode === 'schedule'
                ? `Customer requested AI consultation window: ${requestedWindow || 'not specified'}`
                : 'Customer opened Talk to AI Consultant and requested browser voice')
            : (callConsent ? 'AI Product Consultant call queued' : 'Manual follow-up needed before calling');

        const lead = {
            source,
            sourcePage: clean(data.sourcePage || data.page || ''),
            firstName,
            lastName,
            fullName,
            email,
            company,
            phone,
            rawPhone: clean(data.phone || data.mobile),
            service,
            message,
            languageMode,
            callConsent,
            consultationMode,
            requestedWindow,
            leadStatus: 'new',
            aiConsultantStatus,
            aiCallStatus,
            priority: callConsent || isBrowserConsultation ? 'high' : 'normal',
            assignedTo: '',
            nextAction,
            createdAt: now,
            updatedAt: now
        };

        const inquiryId = makeInquiryId();
        await saveInquiry(inquiryId, lead);

        notifyTelegram({ id: inquiryId, ...lead }).catch((error) => {
            console.warn('Telegram inquiry notification failed:', error);
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, inquiryId, aiCallStatus: lead.aiCallStatus })
        };
    } catch (error) {
        console.error('Create inquiry failed:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
