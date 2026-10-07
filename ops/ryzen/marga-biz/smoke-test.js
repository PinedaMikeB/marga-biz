'use strict';

process.env.TELEGRAM_BOT_TOKEN = '';
process.env.TELEGRAM_CHAT_ID = '';

const { handler: createInquiry } = require('/site/netlify/functions/create-inquiry');
const { getInquiry } = require('/site/netlify/functions/lib/website-inquiries-store');
const { getPool, withClient } = require('/site/netlify/functions/lib/margabase-pg');

const baseUrl = String(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:9400').replace(/\/$/, '');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function request(pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, options);
    const text = await response.text();
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = text;
    }
    return { status: response.status, body };
}

async function run() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await createInquiry({
        httpMethod: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            fullName: `Migration Smoke Test ${suffix}`,
            phone: '+639000000000',
            email: `migration-smoke-${suffix}@example.invalid`,
            company: 'Marga.biz Migration Verification',
            service: 'printer-rental',
            message: 'Disposable migration verification record.',
            callConsent: false,
            source: 'migration-smoke-test'
        })
    });
    assert(created.statusCode === 200, `create handler returned ${created.statusCode}`);

    const createdBody = JSON.parse(created.body || '{}');
    const leadId = createdBody.inquiryId;
    const clientToken = createdBody.clientToken;
    assert(leadId && clientToken && createdBody.savedToDb, 'create handler did not persist an authorized inquiry');

    const results = { baseUrl, leadId, created: true };
    try {
        const noToken = await request('/.netlify/functions/website-inquiries', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadId, updates: { leadStatus: 'unauthorized' } })
        });
        assert(noToken.status === 401, `missing-token PATCH returned ${noToken.status}`);
        results.missingTokenRejected = true;

        const wrongToken = await request('/.netlify/functions/website-inquiries', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                leadId,
                clientToken: 'invalid-migration-token',
                updates: { leadStatus: 'unauthorized' }
            })
        });
        assert(wrongToken.status === 401, `wrong-token PATCH returned ${wrongToken.status}`);
        results.wrongTokenRejected = true;

        const validUpdate = await request('/.netlify/functions/website-inquiries', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                leadId,
                clientToken,
                updates: {
                    leadStatus: 'migration_verified',
                    nextAction: 'Delete smoke-test row'
                }
            })
        });
        assert(validUpdate.status === 200, `authorized PATCH returned ${validUpdate.status}`);
        results.authorizedUpdate = true;

        const stored = await getInquiry(leadId);
        assert(stored?.leadStatus === 'migration_verified', 'PostgreSQL readback did not contain the authorized update');
        results.postgresReadback = true;

        const quoteUnauthorized = await request('/.netlify/functions/quote-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadId, clientToken: 'invalid-migration-token' })
        });
        assert(quoteUnauthorized.status === 401, `unauthorized quote request returned ${quoteUnauthorized.status}`);
        results.quoteTokenRejected = true;

        const voiceUnauthorized = await request(`/.netlify/functions/ai-consultant-session?leadId=${encodeURIComponent(leadId)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sdp',
                'X-Lead-Token': 'invalid-migration-token'
            },
            body: 'v=0\r\n'
        });
        assert(voiceUnauthorized.status === 401, `unauthorized AI session returned ${voiceUnauthorized.status}`);
        results.aiTokenRejected = true;

        return results;
    } finally {
        if (leadId) {
            await withClient((client) => client.query(
                'delete from website.inquiries where inquiry_id = $1',
                [leadId]
            ));
            results.deleted = true;
        }
    }
}

run()
    .then(async (results) => {
        console.log(JSON.stringify(results));
        await getPool().end();
    })
    .catch(async (error) => {
        console.error(error.stack || error.message);
        await getPool().end().catch(() => {});
        process.exitCode = 1;
    });
