#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
version=$(node -p "require('./prototype/package.json').version")
arch=$(node -p 'process.arch')
app="release/Castiel-darwin-$arch/Castiel.app"
dmg="release/Castiel-$version-mac-$arch.dmg"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

ditto "$app" "$stage/Castiel.app"
ln -s /Applications "$stage/Applications"
hdiutil create -ov -fs HFS+ -format UDZO -volname Castiel -srcfolder "$stage" "$dmg" >&2
echo "$dmg"
