#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM_DIR="${MARGA_PLATFORM_DIR:-/Volumes/Wotg Drive Mike/GitHub/marga-platform}"
REPORT_ROOT="$ROOT_DIR/reports/rollback-points"
STAMP="$(date +%Y%m%d-%H%M%S)"
POINT_DIR="$REPORT_ROOT/$STAMP"
LIVE_URL="${ROLLBACK_SITE_URL:-https://marga.biz}"
SEO_MONITOR_URL="$LIVE_URL/.netlify/functions/seo-monitor-report?days=5"
RESTORE_REPORT="$ROOT_DIR/reports/firebase-storage-download/restore-backup-report.json"
BACKUP_SCRIPT="$PLATFORM_DIR/scripts/backup-homebrew-postgres.sh"
BACKUP_ROOT="$HOME/Marga Backups/Database"
FALLBACK_DUMP_DIR="$HOME/Marga Backups/Database"

mkdir -p "$POINT_DIR"

echo "Creating rollback point at $POINT_DIR"

if [[ -x "$BACKUP_SCRIPT" || -f "$BACKUP_SCRIPT" ]]; then
  MARGABASE_RCLONE_REMOTE=__disabled__ bash "$BACKUP_SCRIPT"
else
  echo "Missing backup script: $BACKUP_SCRIPT" >&2
  exit 1
fi

LATEST_DUMP_PATH="$(cat "$BACKUP_ROOT/latest-dump.path" 2>/dev/null || true)"
LATEST_DUMP_TS="$(cat "$BACKUP_ROOT/latest-dump-ts.txt" 2>/dev/null || true)"
LATEST_COUNTS_PATH="$BACKUP_ROOT/latest-counts.txt"
LATEST_GDRIVE_PATH="$(cat "$BACKUP_ROOT/latest-google-drive-folder.path" 2>/dev/null || true)"

curl -LfsS "$SEO_MONITOR_URL" -o "$POINT_DIR/seo-monitor-report.json"

if [[ -f "$RESTORE_REPORT" ]]; then
  cp "$RESTORE_REPORT" "$POINT_DIR/storage-restore-report.json"
fi

git -C "$ROOT_DIR" rev-parse HEAD > "$POINT_DIR/marga-biz-head.txt"
git -C "$ROOT_DIR" status --short > "$POINT_DIR/marga-biz-status.txt" || true
git -C "$PLATFORM_DIR" rev-parse HEAD > "$POINT_DIR/marga-platform-head.txt"
git -C "$PLATFORM_DIR" status --short > "$POINT_DIR/marga-platform-status.txt" || true

node - "$POINT_DIR" "$ROOT_DIR" "$PLATFORM_DIR" "$LATEST_DUMP_PATH" "$LATEST_DUMP_TS" "$LATEST_GDRIVE_PATH" "$LATEST_COUNTS_PATH" "$LIVE_URL" <<'NODE'
const fs = require('fs');
const path = require('path');

const [
  pointDir,
  rootDir,
  platformDir,
  latestDumpPath,
  latestDumpTs,
  latestGdrivePath,
  latestCountsPath,
  liveUrl
] = process.argv.slice(2);

const storageReportPath = path.join(pointDir, 'storage-restore-report.json');
const seoReportPath = path.join(pointDir, 'seo-monitor-report.json');
const bizHead = fs.readFileSync(path.join(pointDir, 'marga-biz-head.txt'), 'utf8').trim();
const platformHead = fs.readFileSync(path.join(pointDir, 'marga-platform-head.txt'), 'utf8').trim();

let storageReport = null;
if (fs.existsSync(storageReportPath)) {
  storageReport = JSON.parse(fs.readFileSync(storageReportPath, 'utf8'));
}

let seoReport = null;
if (fs.existsSync(seoReportPath)) {
  seoReport = JSON.parse(fs.readFileSync(seoReportPath, 'utf8'));
}

const manifest = {
  generatedAt: new Date().toISOString(),
  rollbackPointDir: pointDir,
  siteUrl: liveUrl,
  repos: {
    margaBiz: {
      path: rootDir,
      head: bizHead
    },
    margaPlatform: {
      path: platformDir,
      head: platformHead
    }
  },
  postgres: {
    latestDumpPath: latestDumpPath || null,
    latestDumpTs: latestDumpTs || null,
    latestCountsPath: latestCountsPath || null,
    latestGoogleDriveFolder: latestGdrivePath || null
  },
  storage: storageReport ? {
    outputDir: storageReport.outputDir,
    referencedFirebaseObjects: storageReport.referencedFirebaseObjects,
    present: storageReport.present,
    missingCount: storageReport.missingCount,
    missing: storageReport.missing
  } : null,
  liveSeoMonitor: seoReport ? {
    generatedAt: seoReport.generatedAt || null,
    aiTableUpdatedAt: seoReport.aiSearchTable?.updatedAtIso || null,
    aiTableRows: seoReport.aiSearchTable?.rows?.length || 0,
    rankings: seoReport.rankings?.length || 0
  } : null,
  restoreNotes: [
    'Restore Postgres from latestDumpPath before changing Cloudflare or disabling Netlify.',
    'Keep the current Firebase/Netlify path live until local Postgres reads and writes are proven.',
    'Use the storage outputDir as the local website media baseline.'
  ]
};

fs.writeFileSync(path.join(pointDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
NODE

cat "$POINT_DIR/manifest.json"
