const admin = require('firebase-admin');

function getFirebaseApp() {
    if (admin.apps.length === 0) {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'sah-spiritual-journal'
        });
    }
    return admin.app();
}

function clean(value) {
    return String(value || '').trim();
}

function buildInstructions({ leadId, fullName, company, service, languageMode, message }) {
    const languageRule = languageMode === 'english'
        ? 'Speak in clear, professional English only.'
        : 'Speak naturally in Taglish, with polite Filipino business tone. Use "po" where natural, but keep explanations concise.';

    return [
        'You are the AI Product Consultant for Marga Enterprises, a copier and printer rental provider in Metro Manila and nearby areas.',
        languageRule,
        'Your goal is to qualify the inquiry, understand the office printing/copying need, and recommend the next practical step.',
        'Ask one question at a time. Keep answers short enough for a phone-style conversation.',
        'Do not invent exact pricing or confirmed inventory. Say that the sales team will prepare the official quote after checking requirements and availability.',
        'Collect these details when relevant: office location, number of users, monthly page volume, black-and-white or color needs, scan/copy needs, timeline, contract duration, and whether they need print-all-you-can.',
        'If the customer asks for a human, says they are ready for a quote, or gives urgent timing, acknowledge it and say the Marga sales team will follow up.',
        `Lead ID: ${leadId || 'not yet assigned'}.`,
        `Customer: ${fullName || 'not provided'}.`,
        `Company: ${company || 'not provided'}.`,
        `Service interest: ${service || 'not provided'}.`,
        `Original inquiry: ${message || 'not provided'}.`
    ].join('\n');
}

async function updateLead(leadId, updates) {
    if (!leadId) return;
    const app = getFirebaseApp();
    const db = admin.firestore(app);
    await db.collection('website_inquiries').doc(leadId).set({
        ...updates,
        updatedAt: new Date().toISOString()
    }, { merge: true });
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

        const payload = JSON.parse(event.body || '{}');
        const sdp = clean(payload.sdp);
        if (!sdp) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing WebRTC SDP offer' })
            };
        }

        const lead = payload.lead || {};
        const leadId = clean(payload.leadId);
        const languageMode = clean(lead.languageMode || 'taglish').toLowerCase() === 'english' ? 'english' : 'taglish';

        const session = {
            type: 'realtime',
            model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime',
            instructions: buildInstructions({
                leadId,
                fullName: clean(lead.fullName),
                company: clean(lead.company),
                service: clean(lead.service),
                languageMode,
                message: clean(lead.message)
            }),
            audio: {
                output: {
                    voice: process.env.OPENAI_REALTIME_VOICE || 'marin'
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
            nextAction: 'Browser voice consultation is in progress'
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, sdp: answerSdp })
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
