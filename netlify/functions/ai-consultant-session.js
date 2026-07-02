const { consultantKnowledgeText } = require('./lib/sales-knowledge');
const { getInquiry, mergeInquiry } = require('./lib/website-inquiries-store');

const VALID_REALTIME_VOICES = new Set([
    'alloy',
    'ash',
    'ballad',
    'cedar',
    'coral',
    'echo',
    'marin',
    'sage',
    'shimmer',
    'verse'
]);

function clean(value) {
    return String(value || '').trim();
}

function buildInstructions({ leadId, fullName, company, service, languageMode, message }) {
    const languageRule = languageMode === 'english'
        ? 'Speak in clear, professional English only. Do not speak Chinese, Mandarin, Cantonese, Japanese, Korean, or any other non-English language.'
        : 'Speak only in Taglish: Filipino/Tagalog plus English, with polite Filipino business tone. Use "po" where natural. Do not speak Chinese, Mandarin, Cantonese, Japanese, Korean, Spanish, or any language outside Tagalog/Filipino and English.';

    return [
        'You are the AI Product Consultant for Marga Enterprises, a copier and printer rental provider in Metro Manila and nearby areas.',
        languageRule,
        `Selected language mode: ${languageMode}. Follow this language mode for every spoken response, especially the first greeting.`,
        'Your goal is to help naturally, qualify the inquiry, understand the office printing/copying need, and recommend the next practical step.',
        'Tone: warm, calm, helpful, empathetic, reassuring, interested, and not robotic.',
        'Pacing: speak slower, use short natural pauses, and use short spoken sentences instead of long paragraphs.',
        'Conversation style: listen first, confirm what the customer said, then answer. Ask one question at a time.',
        'Opening flow: greet warmly, ask how they are doing, then ask how you can help or whether they are planning to rent a copier or printer.',
        'Do not open by asking whether they have a problem, why they want to talk, or why they are asking for a quotation.',
        'Use the internal pricing guide only as draft guidance. Do not promise confirmed inventory or a final official quotation. Say Mike or the sales team will approve the official quote after checking requirements and availability.',
        'After the customer confirms rental interest, ask practical questions first: monthly page volume, number of users, office location, black-and-white or color needs, scan/copy needs, timeline, contract duration, and whether they need print-all-you-can.',
        'After practical basics, ask if they currently have a rental or purchased machine and what brand/model it is.',
        'If they name an existing machine, acknowledge it positively, for example "That is a good machine," then ask why they are considering another supplier or another rental option.',
        'If the customer then shares a bad provider experience, lower-rate need, or frustration, validate the concern and explain Marga managed-care app only after you understand the pain.',
        'If volume is low, warn honestly that rental may be expensive and buying a printer may be better.',
        'If the customer wants a copy-center business, ask whether it is a side income or a main business that requires renting space, then warn them to study volume carefully.',
        'If the customer asks for a human, says they are ready for a quote, or gives urgent timing, acknowledge it and say the Marga sales team will follow up.',
        consultantKnowledgeText(),
        `Lead ID: ${leadId || 'not yet assigned'}.`,
        `Customer: ${fullName || 'not provided'}.`,
        `Company: ${company || 'not provided'}.`,
        `Service interest: ${service || 'not provided'}.`,
        `Original inquiry: ${message || 'not provided'}.`
    ].join('\n');
}

function safeVoice(value) {
    const voice = clean(value).toLowerCase();
    return VALID_REALTIME_VOICES.has(voice) ? voice : '';
}

function safeModel(value, fallback) {
    const model = clean(value);
    if (!model || model.length > 80 || /[^a-zA-Z0-9._-]/.test(model)) return fallback;
    return model;
}

function decodeHeaderValue(value) {
    const text = clean(value);
    if (!text) return '';
    try {
        return Buffer.from(text, 'base64').toString('utf8').trim();
    } catch {
        return text;
    }
}

function getLeadFromEvent(event, payload) {
    const headers = event.headers || {};
    return {
        fullName: decodeHeaderValue(headers['x-lead-full-name'] || headers['X-Lead-Full-Name'] || payload.fullName),
        company: decodeHeaderValue(headers['x-lead-company'] || headers['X-Lead-Company'] || payload.company),
        service: decodeHeaderValue(headers['x-lead-service'] || headers['X-Lead-Service'] || payload.service),
        languageMode: decodeHeaderValue(headers['x-lead-language-mode'] || headers['X-Lead-Language-Mode'] || payload.languageMode),
        message: decodeHeaderValue(headers['x-lead-message'] || headers['X-Lead-Message'] || payload.message)
    };
}

async function getLead(leadId) {
    if (!leadId) return null;
    try {
        return await getInquiry(leadId);
    } catch (error) {
        console.warn('Unable to load stored inquiry, continuing with request payload.', error);
        return null;
    }
}

async function getConsultantSettings() {
    const raw = clean(process.env.AI_PRODUCT_CONSULTANT_SETTINGS_JSON);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

async function updateLead(leadId, updates) {
    if (!leadId) return;
    try {
        await mergeInquiry(leadId, {
            ...updates,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.warn('Unable to update inquiry after voice start.', error);
    }
}

function getBodyText(event) {
    const raw = String(event.body || '');
    if (!event.isBase64Encoded) return raw;
    return Buffer.from(raw, 'base64').toString('utf8');
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
        if (!process.env.OPENAI_API_KEY) {
            return {
                statusCode: 501,
                headers,
                body: JSON.stringify({
                    success: false,
                    configured: false,
                    error: 'OPENAI_API_KEY is not configured for browser voice consultation yet.'
                })
            };
        }

        const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
        const isRawSdp = contentType.includes('application/sdp') || contentType.includes('text/plain');
        const bodyText = getBodyText(event);
        const payload = isRawSdp ? {} : JSON.parse(bodyText || '{}');
        const sdp = isRawSdp ? bodyText : clean(payload.sdp);
        if (!sdp) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing WebRTC SDP offer' })
            };
        }

        const leadId = clean(payload.leadId || event.queryStringParameters?.leadId);
        const requestLead = getLeadFromEvent(event, payload);
        const storedLead = await getLead(leadId);
        const lead = storedLead || payload.lead || requestLead || {};
        const consultantSettings = await getConsultantSettings().catch((error) => {
            console.warn('Unable to load AI consultant settings, using defaults.', error);
            return {};
        });
        const languageMode = clean(lead.languageMode || 'taglish').toLowerCase() === 'english' ? 'english' : 'taglish';
        const selectedVoice = safeVoice(consultantSettings.voice) || safeVoice(process.env.OPENAI_REALTIME_VOICE) || 'marin';
        const realtimeModel = safeModel(consultantSettings.realtimeModel, process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime');
        const transcriptionModel = safeModel(consultantSettings.transcriptionModel, process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe');

        const session = {
            type: 'realtime',
            model: realtimeModel,
            instructions: buildInstructions({
                leadId,
                fullName: clean(lead.fullName),
                company: clean(lead.company),
                service: clean(lead.service),
                languageMode,
                message: clean(lead.message)
            }),
            audio: {
                input: {
                    transcription: {
                        model: transcriptionModel,
                        prompt: languageMode === 'english'
                            ? 'Marga Enterprises printer rental, copier rental, office equipment inquiry.'
                            : 'Marga Enterprises printer rental, copier rental, Taglish office equipment inquiry. Preserve Taglish wording when spoken.'
                    }
                },
                output: {
                    voice: selectedVoice
                }
            }
        };

        const fd = new FormData();
        fd.set('sdp', sdp);
        fd.set('session', JSON.stringify(session));

        const response = await fetch('https://api.openai.com/v1/realtime/calls', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: fd
        });

        const answerSdp = await response.text();
        if (!response.ok) {
            console.error('OpenAI realtime call failed:', response.status, answerSdp);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ success: false, configured: true, error: answerSdp })
            };
        }

        await updateLead(leadId, {
            aiConsultantStatus: 'consultation_started',
            aiCallStatus: 'browser_voice_connected',
            leadStatus: 'consulting',
            realtimeModel: session.model,
            transcriptionModel: session.audio.input.transcription.model,
            realtimeVoice: selectedVoice,
            conversationStartedAt: new Date().toISOString(),
            nextAction: 'Browser voice consultation is in progress'
        });

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/sdp'
            },
            body: answerSdp
        };
    } catch (error) {
        console.error('AI consultant session failed:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
