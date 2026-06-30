#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM_DIR="${MARGA_PLATFORM_DIR:-/Volumes/Wotg Drive Mike/GitHub/marga-platform}"
DOWNLOADER="$PLATFORM_DIR/scripts/download-firebase-storage-bucket.mjs"
REPORT_DIR="$ROOT_DIR/reports/firebase-storage-download"
BUCKET="${FIREBASE_STORAGE_BUCKET:-sah-spiritual-journal.firebasestorage.app}"
PREFIX="${FIREBASE_STORAGE_PREFIX:-public/website/}"
OUTPUT_DIR="${MARGA_BIZ_STORAGE_OUTPUT:-$PLATFORM_DIR/apps/margabase/storage/marga-biz}"
PID_FILE="$REPORT_DIR/storage-download.pid"
RUN_LOG="$REPORT_DIR/storage-download-run.log"
LATEST_OUTPUT_PATH="$REPORT_DIR/latest-output.path"
LATEST_LOG_PATH="$REPORT_DIR/latest-log.path"

if [[ ! -f "$DOWNLOADER" ]]; then
  echo "Missing platform downloader: $DOWNLOADER" >&2
  exit 1
fi

SERVICE_ACCOUNT="${GOOGLE_APPLICATION_CREDENTIALS:-}"
if [[ -z "$SERVICE_ACCOUNT" && -f "$ROOT_DIR/service-account-key.json" ]]; then
  SERVICE_ACCOUNT="$ROOT_DIR/service-account-key.json"
fi
if [[ -z "$SERVICE_ACCOUNT" && -f "$PLATFORM_DIR/apps/margabase/secrets/firebase-service-account.json" ]]; then
  SERVICE_ACCOUNT="$PLATFORM_DIR/apps/margabase/secrets/firebase-service-account.json"
fi
if [[ -z "$SERVICE_ACCOUNT" || ! -f "$SERVICE_ACCOUNT" ]]; then
  echo "Missing service account. Set GOOGLE_APPLICATION_CREDENTIALS or add service-account-key.json." >&2
  exit 1
fi

mkdir -p "$REPORT_DIR" "$OUTPUT_DIR"

if [[ -f "$PID_FILE" ]]; then
  existing_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "Storage download is already running with PID $existing_pid"
    echo "Log: $RUN_LOG"
    exit 0
  fi
fi

printf '%s\n' "$OUTPUT_DIR" > "$LATEST_OUTPUT_PATH"
printf '%s\n' "$RUN_LOG" > "$LATEST_LOG_PATH"

nohup node "$DOWNLOADER" \
  --app=margabase \
  --service-account="$SERVICE_ACCOUNT" \
  --bucket="$BUCKET" \
  --prefix="$PREFIX" \
  --output-dir="$OUTPUT_DIR" \
  > "$RUN_LOG" 2>&1 &

pid="$!"
printf '%s\n' "$pid" > "$PID_FILE"

echo "Started Firebase website storage download."
echo "PID: $pid"
echo "Bucket: $BUCKET"
echo "Prefix: $PREFIX"
echo "Output: $OUTPUT_DIR"
echo "Run log: $RUN_LOG"
echo "Status: bash scripts/check-firebase-website-storage-download.sh"
