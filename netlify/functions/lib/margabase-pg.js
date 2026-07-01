const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool = null;

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

function getEnvCandidates() {
    return [
        process.env.MARGABASE_ENV_FILE,
        path.resolve(__dirname, '../../../../marga-platform/apps/margabase/.env'),
        path.resolve(__dirname, '../../../../Marga-Platform/apps/margabase/.env')
    ].filter(Boolean);
}

function resolveEnvFile() {
    const candidates = getEnvCandidates();
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (!found) {
        throw new Error(`Margabase env file not found. Checked: ${candidates.join(', ')}`);
    }
    return found;
}

function getDbConfig() {
    const envPath = resolveEnvFile();
    const envValues = parseEnvFile(envPath);
    return {
        host: process.env.POSTGRES_HOST || envValues.POSTGRES_HOST || '127.0.0.1',
        port: Number(process.env.POSTGRES_PORT || envValues.POSTGRES_PORT || 5432),
        database: process.env.POSTGRES_DB || envValues.POSTGRES_DB,
        user: process.env.POSTGRES_USER || envValues.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD || envValues.POSTGRES_PASSWORD,
        max: 5,
        idleTimeoutMillis: 10000
    };
}

function getPool() {
    if (!pool) {
        pool = new Pool(getDbConfig());
    }
    return pool;
}

async function withClient(fn) {
    const client = await getPool().connect();
    try {
        return await fn(client);
    } finally {
        client.release();
    }
}

module.exports = {
    getDbConfig,
    getPool,
    resolveEnvFile,
    withClient
};
