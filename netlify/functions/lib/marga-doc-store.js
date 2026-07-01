const crypto = require('crypto');
const { withClient } = require('./margabase-pg');

const DOC_STORE_LOCK_KEY = 73110202;
const NUMERIC_FIELDS = new Set(['latestPosition', 'position', 'score', 'seoScore']);
const TIMESTAMP_FIELDS = new Set([
    'checkedAt',
    'checkDate',
    'completedAt',
    'createdAt',
    'foundAt',
    'implementedAt',
    'lastActive',
    'lastCheck',
    'lastScanned',
    'scannedAt',
    'timestamp',
    'updatedAtIso',
    'updatedAt'
]);

function nowIso() {
    return new Date().toISOString();
}

function makeDocId(prefix = 'doc') {
    if (typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target, source) {
    if (!isPlainObject(target) || !isPlainObject(source)) {
        return source;
    }

    const result = { ...target };
    Object.entries(source).forEach(([key, value]) => {
        if (isPlainObject(value) && isPlainObject(result[key])) {
            result[key] = deepMerge(result[key], value);
        } else {
            result[key] = value;
        }
    });
    return result;
}

async function ensureDocStore(client) {
    await client.query('select pg_advisory_lock($1)', [DOC_STORE_LOCK_KEY]);
    try {
        await client.query(`
            create schema if not exists website;

            create table if not exists website.collection_docs (
                collection_name text not null,
                doc_id text not null,
                data jsonb not null default '{}'::jsonb,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                primary key (collection_name, doc_id)
            );

            create index if not exists website_collection_docs_collection_updated_idx
                on website.collection_docs (collection_name, updated_at desc);
        `);
    } finally {
        await client.query('select pg_advisory_unlock($1)', [DOC_STORE_LOCK_KEY]);
    }
}

function assertSafeFieldName(field) {
    if (!/^[A-Za-z0-9_]+$/.test(String(field || ''))) {
        throw new Error(`Unsafe field name: ${field}`);
    }
}

function fieldExpr(field) {
    assertSafeFieldName(field);
    const quoted = `'${field}'`;

    if (NUMERIC_FIELDS.has(field)) {
        return `case
            when jsonb_typeof(data -> ${quoted}) = 'number' then (data->>${quoted})::numeric
            when (data->>${quoted}) ~ '^-?[0-9]+(\\.[0-9]+)?$' then (data->>${quoted})::numeric
            else null
        end`;
    }

    if (TIMESTAMP_FIELDS.has(field)) {
        return `case
            when nullif(data->>${quoted}, '') is null then null
            else (data->>${quoted})::timestamptz
        end`;
    }

    return `data->>${quoted}`;
}

function buildWhereClause(filters = [], values = [], startIndex = 3) {
    const clauses = [];
    let index = startIndex;

    filters.forEach((filter) => {
        const { field, op, value } = filter;
        const expr = fieldExpr(field);
        const sqlOp = op === '==' ? '=' : op;
        clauses.push(`${expr} ${sqlOp} $${index}`);
        values.push(value instanceof Date ? value.toISOString() : value);
        index += 1;
    });

    return {
        clause: clauses.length ? `and ${clauses.join(' and ')}` : '',
        nextIndex: index
    };
}

function normalizeRow(row) {
    if (!row) return null;
    return { id: row.doc_id, ...row.data };
}

async function getDoc(collectionName, docId) {
    return withClient(async (client) => {
        await ensureDocStore(client);
        const result = await client.query(
            `select doc_id, data
             from website.collection_docs
             where collection_name = $1 and doc_id = $2`,
            [collectionName, docId]
        );
        return normalizeRow(result.rows[0] || null);
    });
}

async function setDoc(collectionName, docId, data, options = {}) {
    return withClient(async (client) => {
        await ensureDocStore(client);
        const existing = options.merge ? await getDoc(collectionName, docId) : null;
        const mergedData = options.merge ? deepMerge(existing || {}, data || {}) : (data || {});
        const payload = { ...mergedData };
        delete payload.id;

        const createdAt = payload.createdAt || existing?.createdAt || nowIso();
        const updatedAt = payload.updatedAt || nowIso();
        payload.createdAt = createdAt;
        payload.updatedAt = updatedAt;

        await client.query(
            `insert into website.collection_docs (
                collection_name,
                doc_id,
                data,
                created_at,
                updated_at
            ) values ($1, $2, $3::jsonb, $4::timestamptz, $5::timestamptz)
            on conflict (collection_name, doc_id) do update set
                data = excluded.data,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at`,
            [
                collectionName,
                docId,
                JSON.stringify(payload),
                createdAt,
                updatedAt
            ]
        );

        return { id: docId, ...payload };
    });
}

async function updateDoc(collectionName, docId, updates) {
    const existing = await getDoc(collectionName, docId);
    if (!existing) {
        throw new Error(`Document not found: ${collectionName}/${docId}`);
    }
    return setDoc(collectionName, docId, deepMerge(existing, updates || {}));
}

async function addDoc(collectionName, data, options = {}) {
    const docId = options.docId || makeDocId(collectionName.replace(/[^A-Za-z0-9]+/g, '_'));
    return setDoc(collectionName, docId, data || {});
}

async function deleteDoc(collectionName, docId) {
    return withClient(async (client) => {
        await ensureDocStore(client);
        await client.query(
            `delete from website.collection_docs
             where collection_name = $1 and doc_id = $2`,
            [collectionName, docId]
        );
    });
}

async function listDocs(collectionName, options = {}) {
    return withClient(async (client) => {
        await ensureDocStore(client);

        const values = [collectionName];
        const filters = Array.isArray(options.filters) ? options.filters : [];
        const { clause } = buildWhereClause(filters, values, 2);

        let orderSql = 'order by updated_at desc';
        if (options.orderBy) {
            const field = options.orderBy.field || options.orderBy;
            const direction = String(options.orderBy.direction || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
            orderSql = `order by ${fieldExpr(field)} ${direction} nulls last, updated_at desc`;
        }

        let limitSql = '';
        if (options.limit) {
            values.push(Number(options.limit));
            limitSql = `limit $${values.length}`;
        }

        const result = await client.query(
            `select doc_id, data
             from website.collection_docs
             where collection_name = $1
             ${clause}
             ${orderSql}
             ${limitSql}`,
            values
        );

        return result.rows.map(normalizeRow);
    });
}

module.exports = {
    addDoc,
    deleteDoc,
    getDoc,
    listDocs,
    nowIso,
    setDoc,
    updateDoc
};
