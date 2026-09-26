#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../cocos-client" && pwd)"
CREATOR_BIN="${COCOS_CREATOR_BIN:-/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator}"
PLATFORM="${1:-web-desktop}"
if [ ! -x "$CREATOR_BIN" ]; then
  echo "Cocos Creator CLI not found: $CREATOR_BIN" >&2
  echo "Set COCOS_CREATOR_BIN to the installed CocosCreator executable." >&2
  exit 2
fi
set +e
"$CREATOR_BIN" --project "$PROJECT_DIR" --build "platform=$PLATFORM;debug=true"
build_status=$?
set -e
# Creator documents 36 as a successful build, which shells otherwise treat as failure.
if [ "$build_status" -ne 36 ]; then exit "$build_status"; fi
case "$PLATFORM" in
  wechatgame|bytedance-mini-game) node "$SCRIPT_DIR/cocos-sync-appid.js" "$PLATFORM" ;;
esac
