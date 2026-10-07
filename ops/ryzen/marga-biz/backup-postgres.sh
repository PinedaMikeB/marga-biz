#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/ops/ryzen/marga-biz/compose.yaml"
RUNTIME_ROOT="${MARGA_BIZ_RUNTIME_ROOT:-/srv/apps/marga-biz-runtime}"
BACKUP_DIR="$RUNTIME_ROOT/backups/postgres"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT="$BACKUP_DIR/marga-biz-$STAMP.dump"
TEMP_OUTPUT="$OUTPUT.partial"

mkdir -p "$BACKUP_DIR"
umask 077

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump --format=custom --no-owner --no-privileges \
  --username=marga_biz_app --dbname=marga_biz > "$TEMP_OUTPUT"

pg_restore --list "$TEMP_OUTPUT" >/dev/null
mv "$TEMP_OUTPUT" "$OUTPUT"
sha256sum "$OUTPUT" > "$OUTPUT.sha256"

printf '%s\n' "$OUTPUT"
