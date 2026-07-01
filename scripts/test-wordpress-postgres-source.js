const { withMargabaseClient } = require('./lib/margabase-local-db');

async function main() {
    await withMargabaseClient(async (client) => {
        const counts = await client.query(`
            select
                count(*) filter (where kind = 'page')::int as pages,
                count(*) filter (where kind = 'post')::int as posts,
                max(updated_at) as updated_at
            from website.content_items
        `);

        const sample = await client.query(`
            select kind, slug, link, title
            from website.content_items
            where link in (
                'https://marga.biz/',
                'https://marga.biz/printer-rental/',
                'https://marga.biz/copier-rental/copier-for-rent/'
            )
            order by kind asc, link asc
        `);

        console.log(JSON.stringify({
            counts: counts.rows[0],
            samples: sample.rows,
        }, null, 2));
    });
}

main().catch((error) => {
    console.error('Postgres content source test failed:', error.message);
    process.exit(1);
});
