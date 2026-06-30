#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM_DIR="${MARGA_PLATFORM_DIR:-/Volumes/Wotg Drive Mike/GitHub/marga-platform}"
BACKUP_ROOT="${MARGA_BIZ_STORAGE_BACKUP:-$PLATFORM_DIR/backups/margabase/full-firebase-backups/2026-05-15T14-15-32-138Z/firebase-storage}"
OUTPUT_DIR="${MARGA_BIZ_STORAGE_OUTPUT:-$PLATFORM_DIR/apps/margabase/storage/marga-biz}"
SOURCE_DIR="$BACKUP_ROOT/public/website"
DEST_DIR="$OUTPUT_DIR/public/website"
REPORT_DIR="$ROOT_DIR/reports/firebase-storage-download"
REPORT_PATH="$REPORT_DIR/restore-backup-report.json"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Missing storage backup folder: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR" "$REPORT_DIR"

rsync -a "$SOURCE_DIR/" "$DEST_DIR/"

if [[ ! -f "$DEST_DIR/marga-logo.png" && -f "$ROOT_DIR/marga-logo.png" ]]; then
  cp "$ROOT_DIR/marga-logo.png" "$DEST_DIR/marga-logo.png"
fi

node - "$ROOT_DIR" "$OUTPUT_DIR" "$REPORT_PATH" <<'NODE'
const fs = require('fs');
const path = require('path');

const rootDir = process.argv[2];
const outputDir = process.argv[3];
const reportPath = process.argv[4];
const scannedFiles = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (/\.(html|json)$/i.test(entry.name)) scannedFiles.push(target);
  }
}

for (const dir of ['dist', 'static-pages', 'data']) {
  walk(path.join(rootDir, dir));
}

const objects = new Set();
const re = /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/sah-spiritual-journal\.firebasestorage\.app\/o\/([^"'\s<>),]+)/g;

for (const file of scannedFiles) {
  const text = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = re.exec(text))) {
    const raw = match[1].split('?')[0].split('&')[0];
    try {
      objects.add(decodeURIComponent(raw));
    } catch {
      objects.add(raw);
    }
  }
}

let present = 0;
const missing = [];
for (const object of objects) {
  if (fs.existsSync(path.join(outputDir, object))) present += 1;
  else missing.push(object);
}

const report = {
  generatedAt: new Date().toISOString(),
  outputDir,
  scannedFiles: scannedFiles.length,
  referencedFirebaseObjects: objects.size,
  present,
  missingCount: missing.length,
  missing
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
NODE

echo "Restored Firebase website storage backup."
echo "Destination: $DEST_DIR"
echo "Report: $REPORT_PATH"
