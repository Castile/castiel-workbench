#!/usr/bin/env bash
set -euo pipefail

dmg=${1:?Pass the path to the disk image}
temp=$(mktemp -d)
mount="$temp/mount"
app="$temp/Installed Castiel.app"
export CASTIEL_DATA_DIR="$temp/Test Data"
mounted=false
pid=''
cleanup() {
  if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; fi
  if [[ "$mounted" == true ]]; then hdiutil detach "$mount" || return; fi
  rm -rf "$temp"
}
trap cleanup EXIT

hdiutil verify "$dmg"
mkdir "$mount"
hdiutil attach -readonly -nobrowse -mountpoint "$mount" "$dmg"
mounted=true
test "$(readlink "$mount/Applications")" = /Applications
ditto "$mount/Castiel.app" "$app"
hdiutil detach "$mount"
mounted=false
codesign --verify --deep --strict "$app"
lipo "$app/Contents/MacOS/Castiel" -verify_arch "$(uname -m)"
"$app/Contents/MacOS/Castiel" &
pid=$!
doc="$CASTIEL_DATA_DIR/workbench.json"
for ((i=0; i<120; i++)); do
  kill -0 "$pid"
  [[ -s "$doc" ]] && break
  sleep 0.5
done
node -e 'if (!require(process.argv[1]).data.spaces?.length) process.exit(1)' "$doc"
# Address only the process launched by this test, even if another Castiel is open.
osascript -l JavaScript -e "ObjC.import('AppKit'); $.NSRunningApplication.runningApplicationWithProcessIdentifier($pid).terminate"
for ((i=0; i<60; i++)); do
  kill -0 "$pid" 2>/dev/null || break
  sleep 0.5
done
if kill -0 "$pid" 2>/dev/null; then echo "Normal shutdown timed out" >&2; exit 1; fi
wait "$pid"
pid=''
