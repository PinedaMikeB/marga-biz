const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { withMargabaseClient } = require('./lib/margabase-local-db');

const wpDataPath = path.join(__dirname, '../data/wordpress-data.json');

function hashPayload(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function main() {
    if (!fs.existsSync(wpDataPath)) {
        throw new Error(`Missing ${wpDataPath}`);
    }

    const wpData = JSON.parse(fs.readFileSync(wpDataPath, 'utf8'));
    const pages = wpData.pages || [];
    const posts = wpData.posts || [];

    console.log(`Importing ${pages.length} pages and ${posts.length} posts into local Postgres...`);

    await withMargabaseClient(async (client) => {
        await client.query('begin');
        try {
            await client.query(`
                create schema if not exists website;

                create table if not exists website.content_items (
                    id bigserial primary key,
                    kind text not null check (kind in ('page', 'post')),
                    slug text,
                    link text not null,
                    title text,
                    sort_index integer not null default 0,
                    content_hash text not null,
                    data jsonb not null,
                    imported_at timestamptz not null default now(),
                    updated_at timestamptz not null default now(),
                    unique (kind, link)
                );

                create index if not exists website_content_items_kind_sort_idx
                    on website.content_items (kind, sort_index, id);

                create index if not exists website_content_items_slug_idx
                    on website.content_items (slug);
            `);

            await client.query('delete from website.content_items');

            const insertSql = `
                insert into website.content_items (
                    kind, slug, link, title, sort_index, content_hash, data, imported_at, updated_at
                ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
            `;

            for (let i = 0; i < pages.length; i += 1) {
                const item = pages[i];
                await client.query(insertSql, [
                    'page',
                    item.slug || null,
                    item.link,
                    item.title || null,
                    i,
                    hashPayload(item),
                    JSON.stringify(item),
                ]);
            }

            for (let i = 0; i < posts.length; i += 1) {
                const item = posts[i];
                await client.query(insertSql, [
                    'post',
                    item.slug || null,
                    item.link,
                    item.title || null,
                    i,
                    hashPayload(item),
                    JSON.stringify(item),
                ]);
            }

            await client.query('commit');
        } catch (error) {
            await client.query('rollback');
            throw error;
        }
    });

    console.log('Import complete.');
}

main().catch((error) => {
    console.error('Import failed:', error.message);
    process.exit(1);
});
