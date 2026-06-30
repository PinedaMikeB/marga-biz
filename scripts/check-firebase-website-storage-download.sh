#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$ROOT_DIR/reports/firebase-storage-download"
PID_FILE="$REPORT_DIR/storage-download.pid"
RUN_LOG="$REPORT_DIR/storage-download-run.log"
OUTPUT_DIR="$(cat "$REPORT_DIR/latest-output.path" 2>/dev/null || true)"
STATE_LOG="$OUTPUT_DIR/_state/storage-download.log"
MANIFEST="$OUTPUT_DIR/manifest.json"
OBJECTS="$OUTPUT_DIR/_state/objects.json"

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "Status: running"
    echo "PID: $pid"
  else
    echo "Status: not running"
    [[ -n "$pid" ]] && echo "Last PID: $pid"
  fi
else
  echo "Status: not started"
fi

[[ -n "$OUTPUT_DIR" ]] && echo "Output: $OUTPUT_DIR"
[[ -f "$RUN_LOG" ]] && echo "Run log: $RUN_LOG"
[[ -f "$STATE_LOG" ]] && echo "State log: $STATE_LOG"

if [[ -f "$MANIFEST" ]]; then
  node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log('Manifest objects:', m.totalObjects); console.log('Manifest bytes:', m.totalBytes);" "$MANIFEST"
fi

if [[ -n "$OUTPUT_DIR" && -d "$OUTPUT_DIR/public/website" ]]; then
  echo "Downloaded files:"
  find "$OUTPUT_DIR/public/website" -type f | wc -l | tr -d ' '
  echo "Downloaded size:"
  du -sh "$OUTPUT_DIR/public/website" | awk '{print $1}'
fi

if [[ -f "$OBJECTS" && -n "$OUTPUT_DIR" && -d "$OUTPUT_DIR/public/website" ]]; then
  node - "$OBJECTS" "$OUTPUT_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');
const objects = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outputDir = process.argv[3];
let present = 0;
for (const object of objects) {
  if (fs.existsSync(path.join(outputDir, object.name))) present += 1;
}
console.log(`Progress: ${present}/${objects.length}`);
NODE
fi

echo "Recent log:"
if [[ -f "$STATE_LOG" ]]; then
  tail -12 "$STATE_LOG"
elif [[ -f "$RUN_LOG" ]]; then
  tail -12 "$RUN_LOG"
else
  echo "(no log yet)"
fi
