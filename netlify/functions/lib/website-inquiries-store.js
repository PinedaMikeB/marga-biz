const crypto = require('crypto');
const { withClient } = require('./margabase-pg');

function parseTimestamp(value, fallback) {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toISOString();
}

function makeInquiryId() {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const suffix = Math.random().toString(36).slice(2, 8);
    return `web-${stamp}-${suffix}`;
}

function mapLeadScalars(inquiryId, data) {
    const createdAt = parseTimestamp(data.createdAt, new Date().toISOString());
    const updatedAt = parseTimestamp(data.updatedAt, createdAt);
    return {
        inquiryId,
        fullName: data.fullName || '',
        email: data.email || '',
        company: data.company || '',
        phone: data.phone || '',
        service: data.service || '',
        leadStatus: data.leadStatus || '',
        aiConsultantStatus: data.aiConsultantStatus || '',
        aiCallStatus: data.aiCallStatus || '',
        priority: data.priority || '',
        createdAt,
        updatedAt
    };
}

function normalizeLeadRecord(row) {
    if (!row) return null;
    return {
        _docId: row.inquiry_id,
        ...row.data
    };
}

async function ensureWebsiteInquiriesTable(client) {
    await client.query('select pg_advisory_lock($1)', [73110201]);
    try {
        await client.query(`
            create schema if not exists website;

            create table if not exists website.inquiries (
                inquiry_id text primary key,
                full_name text not null default '',
                email text not null default '',
                company text not null default '',
                phone text not null default '',
                service text not null default '',
                lead_status text not null default '',
                ai_consultant_status text not null default '',
                ai_call_status text not null default '',
                priority text not null default '',
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                data jsonb not null
            );

            create index if not exists website_inquiries_created_at_idx
                on website.inquiries (created_at desc);

            create index if not exists website_inquiries_status_idx
                on website.inquiries (lead_status, ai_call_status);
        `);
    } finally {
        await client.query('select pg_advisory_unlock($1)', [73110201]);
    }
}

async function getInquiry(inquiryId) {
    return withClient(async (client) => {
        await ensureWebsiteInquiriesTable(client);
        const result = await client.query(
            `select inquiry_id, data
             from website.inquiries
             where inquiry_id = $1`,
            [inquiryId]
        );
        return normalizeLeadRecord(result.rows[0] || null);
    });
}

async function listInquiries(limit = 120) {
    return withClient(async (client) => {
        await ensureWebsiteInquiriesTable(client);
        const result = await client.query(
            `select inquiry_id, data
             from website.inquiries
             order by created_at desc
             limit $1`,
            [Math.min(Number(limit) || 120, 300)]
        );
        return result.rows.map(normalizeLeadRecord);
    });
}

async function saveInquiry(inquiryId, data) {
    return withClient(async (client) => {
        await ensureWebsiteInquiriesTable(client);
        const scalars = mapLeadScalars(inquiryId, data);
        await client.query(
            `insert into website.inquiries (
                inquiry_id,
                full_name,
                email,
                company,
                phone,
                service,
                lead_status,
                ai_consultant_status,
                ai_call_status,
                priority,
                created_at,
                updated_at,
                data
            ) values (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz, $13::jsonb
            )
            on conflict (inquiry_id) do update set
                full_name = excluded.full_name,
                email = excluded.email,
                company = excluded.company,
                phone = excluded.phone,
                service = excluded.service,
                lead_status = excluded.lead_status,
                ai_consultant_status = excluded.ai_consultant_status,
                ai_call_status = excluded.ai_call_status,
                priority = excluded.priority,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at,
                data = excluded.data`,
            [
                scalars.inquiryId,
                scalars.fullName,
                scalars.email,
                scalars.company,
                scalars.phone,
                scalars.service,
                scalars.leadStatus,
                scalars.aiConsultantStatus,
                scalars.aiCallStatus,
                scalars.priority,
                scalars.createdAt,
                scalars.updatedAt,
                JSON.stringify({
                    ...data,
                    createdAt: scalars.createdAt,
                    updatedAt: scalars.updatedAt
                })
            ]
        );
        return inquiryId;
    });
}

async function mergeInquiry(inquiryId, updates) {
    return withClient(async (client) => {
        await ensureWebsiteInquiriesTable(client);
        const existingResult = await client.query(
            `select data from website.inquiries where inquiry_id = $1`,
            [inquiryId]
        );
        if (existingResult.rowCount === 0) {
            throw new Error('Lead not found');
        }
        const merged = {
            ...existingResult.rows[0].data,
            ...updates
        };
        const updatedAt = parseTimestamp(merged.updatedAt, new Date().toISOString());
        merged.updatedAt = updatedAt;
        await saveInquiry(inquiryId, merged);
        return normalizeLeadRecord({ inquiry_id: inquiryId, data: merged });
    });
}

function tokenHash(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

module.exports = {
    ensureWebsiteInquiriesTable,
    getInquiry,
    listInquiries,
    makeInquiryId,
    mergeInquiry,
    saveInquiry,
    tokenHash
};
