const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function parseEnvFile(filePath) {
    const values = {};
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        values[key] = value;
    }
    return values;
}

function getMargabaseEnvCandidates() {
    return [
        process.env.MARGABASE_ENV_FILE,
        path.resolve(__dirname, '../../../marga-platform/apps/margabase/.env'),
        path.resolve(__dirname, '../../../Marga-Platform/apps/margabase/.env')
    ].filter(Boolean);
}

function resolveMargabaseEnv() {
    const candidates = getMargabaseEnvCandidates();
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (!found) {
        throw new Error(`Margabase env file not found. Checked: ${candidates.join(', ')}`);
    }
    return found;
}

function getMargabaseDbConfig() {
    const envPath = resolveMargabaseEnv();
    const envValues = parseEnvFile(envPath);
    return {
        host: process.env.POSTGRES_HOST || envValues.POSTGRES_HOST || '127.0.0.1',
        port: Number(process.env.POSTGRES_PORT || envValues.POSTGRES_PORT || 5432),
        database: process.env.POSTGRES_DB || envValues.POSTGRES_DB,
        user: process.env.POSTGRES_USER || envValues.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD || envValues.POSTGRES_PASSWORD,
    };
}

async function withMargabaseClient(fn) {
    const client = new Client(getMargabaseDbConfig());
    await client.connect();
    try {
        return await fn(client);
    } finally {
        await client.end();
    }
}

async function loadWordpressDatasetFromPostgres() {
    return withMargabaseClient(async (client) => {
        const result = await client.query(`
            select kind, data
            from website.content_items
            order by kind asc, sort_index asc, id asc
        `);

        const dataset = { pages: [], posts: [] };
        for (const row of result.rows) {
            if (row.kind === 'page') {
                dataset.pages.push(row.data);
            } else if (row.kind === 'post') {
                dataset.posts.push(row.data);
            }
        }
        return dataset;
    });
}

module.exports = {
    getMargabaseDbConfig,
    loadWordpressDatasetFromPostgres,
    resolveMargabaseEnv,
    withMargabaseClient,
};
