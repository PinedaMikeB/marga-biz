#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/ops/ryzen/marga-biz/compose.yaml"

docker compose -f "$COMPOSE_FILE" ps
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql --username=marga_biz_app --dbname=marga_biz --no-psqlrc --tuples-only --no-align \
  --command="
    select 'website.content_items|' || count(*) from website.content_items
    union all
    select 'website.inquiries|' || count(*) from website.inquiries
    union all
    select 'website.collection_docs|' || count(*) from website.collection_docs
    order by 1;
  "
