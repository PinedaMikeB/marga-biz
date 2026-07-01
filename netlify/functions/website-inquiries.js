const { listInquiries, mergeInquiry } = require('./lib/website-inquiries-store');

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };
}

function clean(value) {
    return String(value || '').trim();
}

function safeUpdates(input) {
    const allowed = new Set([
        'aiCallStatus',
        'aiConsultantStatus',
        'assignedTo',
        'leadStatus',
        'nextAction',
        'priority',
        'salesCallRequested',
        'salesCallRequestedAt',
        'conversationStartedAt',
        'conversationEndedAt',
        'conversationDurationSeconds',
        'transcript',
        'transcriptUpdatedAt',
        'usage',
        'estimatedCostUsd',
        'estimatedCostPhp',
        'realtimeModel',
        'transcriptionModel'
    ]);

    const updates = {};
    Object.entries(input || {}).forEach(([key, value]) => {
        if (allowed.has(key)) updates[key] = value;
    });
    updates.updatedAt = new Date().toISOString();
    return updates;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return json(200, {});
    }

    try {
        if (event.httpMethod === 'GET') {
            const limit = Math.min(Number(event.queryStringParameters?.limit || 120), 300);
            const leads = await listInquiries(limit);

            return json(200, { success: true, leads });
        }

        if (event.httpMethod === 'PATCH') {
            const body = JSON.parse(event.body || '{}');
            const leadId = clean(body.leadId);
            if (!leadId) return json(400, { success: false, error: 'leadId is required' });

            const updates = safeUpdates(body.updates);
            await mergeInquiry(leadId, updates);

            return json(200, { success: true, leadId, updates });
        }

        return json(405, { success: false, error: 'Method not allowed' });
    } catch (error) {
        console.error('Website inquiries API failed:', error);
        return json(500, { success: false, error: error.message });
    }
};
