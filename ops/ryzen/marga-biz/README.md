# Marga.biz Ryzen runtime

This stack is intentionally independent from Margabase and Marga App.

## Host paths

- Source checkout: `/srv/apps/marga-biz`
- Runtime state: `/srv/apps/marga-biz-runtime`
- PostgreSQL data: `/srv/apps/marga-biz-runtime/postgres-data`
- Website storage: `/srv/apps/marga-biz-runtime/storage`
- PostgreSQL backups: `/srv/apps/marga-biz-runtime/backups/postgres`
- Secrets: `/srv/apps/marga-biz-runtime/secrets`

The PostgreSQL service does not publish a host or LAN port. Applications must
join the private `marga-biz-database` Docker network.

## Required secret

Create `/srv/apps/marga-biz-runtime/secrets/postgres-password.txt` with mode
`0600`. Never commit this file.

## Start and verify

```bash
cd /srv/apps/marga-biz
docker compose -f ops/ryzen/marga-biz/compose.yaml up -d postgres
bash ops/ryzen/marga-biz/verify-postgres.sh
```

## Back up

```bash
cd /srv/apps/marga-biz
bash ops/ryzen/marga-biz/backup-postgres.sh
```

Every backup is written in PostgreSQL custom format, validated with
`pg_restore --list`, and accompanied by a SHA-256 checksum.

## Migration guardrails

- Do not connect this container to the Margabase volume or Docker network.
- Do not publish PostgreSQL port 5432.
- Restore the Mac `website` schema only into the new `marga_biz` database.
- Keep the existing Ryzen static service on port 9300 unchanged during tests.
- Do not change the Cloudflare production route until the complete website,
  functions, inquiry writes, and media have been verified on a private route.
- Keep the Mac source and database copy available until post-cutover audit.
