#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_MEDIA_DIR="$ROOT_DIR/dist/website-media"
TEMP_FILE_LIST="$(mktemp)"
trap 'rm -f "$TEMP_FILE_LIST"' EXIT

SOURCE_CANDIDATES=()
if [[ -n "${MARGA_BIZ_WEBSITE_STORAGE_DIR:-}" ]]; then
  SOURCE_CANDIDATES+=("${MARGA_BIZ_WEBSITE_STORAGE_DIR}")
fi
SOURCE_CANDIDATES+=(
  "/Volumes/Wotg Drive Mike/GitHub/marga-platform/backups/margabase/full-firebase-backups/2026-05-15T14-15-32-138Z/firebase-storage/public/website"
  "/Volumes/Wotg Drive Mike/GitHub/marga-platform/apps/margabase/storage/marga-biz/public/website"
  "/Volumes/Wotg Drive Mike/GitHub/Marga-Platform/apps/margabase/storage/marga-biz/public/website"
)

SOURCE_DIR=""
for candidate in "${SOURCE_CANDIDATES[@]}"; do
  if [[ -d "$candidate" ]]; then
    SOURCE_DIR="$candidate"
    break
  fi
done

if [[ -z "$SOURCE_DIR" ]]; then
  echo "No local website media source directory found." >&2
  exit 1
fi

mkdir -p "$DIST_MEDIA_DIR"
rm -rf "$DIST_MEDIA_DIR"
mkdir -p "$DIST_MEDIA_DIR"

{
  printf '%s\n' 'marga-logo.png'

  rg -o --no-filename "https?://marga\\.biz/wp-content/uploads/\\d{4}/\\d{2}/[^\"'[:space:],>]+" \
    "$ROOT_DIR/data/wordpress-data.json" \
    | sed -E 's#^.*/uploads/[0-9]{4}/[0-9]{2}/##' \
    | sed -E 's/\?.*$//' \
    | sed -E 's#\\+$##' \
    | sed -E 's/-[0-9]+x[0-9]+(\.[A-Za-z0-9]+)$/\1/'

  rg -o --no-filename "https://firebasestorage.googleapis.com/v0/b/sah-spiritual-journal.firebasestorage.app/o/public%2Fwebsite%2F[^\"'[:space:]<>)]+\\?alt=media" \
    "$ROOT_DIR/data/wordpress-data.json" \
    "$ROOT_DIR/static-pages" \
    "$ROOT_DIR/components" \
    "$ROOT_DIR/templates" \
    | sed -E 's#^.*public%2Fwebsite%2F##' \
    | sed -E 's#\\?alt=media$##' \
    | python3 -c 'import re, sys, urllib.parse; [print(re.sub(r"-[0-9]+x[0-9]+(\\.[A-Za-z0-9]+)$", r"\\1", urllib.parse.unquote(line.strip()).rstrip("\\"))) for line in sys.stdin if line.strip()]'
} | sort -u \
  | grep -vx 'og-image.png' \
  | grep -vx 'ChatGPT-Image-Apr-15-2025-11_35_46-AM.png' \
  > "$TEMP_FILE_LIST"

echo "Syncing website media from: $SOURCE_DIR"
echo "Required files: $(wc -l < "$TEMP_FILE_LIST" | tr -d ' ')"

copied_count=0
missing_count=0

while IFS= read -r filename; do
  [[ -n "$filename" ]] || continue
  source_path=""
  for candidate in "${SOURCE_CANDIDATES[@]}"; do
    if [[ -f "$candidate/$filename" ]]; then
      source_path="$candidate/$filename"
      break
    fi
  done

  if [[ -z "$source_path" ]]; then
    ((missing_count+=1))
    continue
  fi

  if ln "$source_path" "$DIST_MEDIA_DIR/$filename" 2>/dev/null || cp "$source_path" "$DIST_MEDIA_DIR/$filename" 2>/dev/null; then
    ((copied_count+=1))
  fi
done < "$TEMP_FILE_LIST"

echo "Copied files: $copied_count"
echo "Missing listed files: $missing_count"

if [[ ! -f "$DIST_MEDIA_DIR/og-image.png" && -f "$ROOT_DIR/marga-logo.png" ]]; then
  cp "$ROOT_DIR/marga-logo.png" "$DIST_MEDIA_DIR/og-image.png"
  echo "Created fallback: og-image.png"
fi

if [[ ! -f "$DIST_MEDIA_DIR/ChatGPT-Image-Apr-15-2025-11_35_46-AM.png" && -f "$DIST_MEDIA_DIR/ChatGPT-Image-Apr-15-2025-11_35_45-AM.png" ]]; then
  cp "$DIST_MEDIA_DIR/ChatGPT-Image-Apr-15-2025-11_35_45-AM.png" "$DIST_MEDIA_DIR/ChatGPT-Image-Apr-15-2025-11_35_46-AM.png"
  echo "Created fallback: ChatGPT-Image-Apr-15-2025-11_35_46-AM.png"
fi

file_count="$(find "$DIST_MEDIA_DIR" -type f | wc -l | tr -d ' ')"
echo "Website media files ready: $file_count"
