#!/bin/zsh
set -euo pipefail

REPO_ROOT="${1:-$HOME/.codex/repos/marga-biz-automation}"
TARGET_HOUR="${2:-9}"
TARGET_MINUTE="${3:-0}"
TEMPLATE_PATH="$REPO_ROOT/ops/printer-seo-daily.plist"
TARGET_PATH="$HOME/Library/LaunchAgents/com.marga.printer-seo-daily.plist"
LABEL="com.marga.printer-seo-daily"

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "Missing template plist at $TEMPLATE_PATH" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"

sed \
  -e "s|__HOME__|$HOME|g" \
  -e "s|__REPO_ROOT__|$REPO_ROOT|g" \
  -e "s|__TARGET_HOUR__|$TARGET_HOUR|g" \
  -e "s|__TARGET_MINUTE__|$TARGET_MINUTE|g" \
  "$TEMPLATE_PATH" > "$TARGET_PATH"

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$TARGET_PATH"
launchctl enable "gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "Installed $LABEL using $TARGET_PATH"
