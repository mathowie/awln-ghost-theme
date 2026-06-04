#!/usr/bin/env bash
# Build a Ghost-uploadable zip of the theme. Reads version from package.json.
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || \
          grep -m1 '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')
mkdir -p dist
OUT="dist/awln-v${VERSION}.zip"
rm -f "$OUT"
zip -qr "$OUT" . \
  -x ".git/*" ".gitignore" "LICENSE" "package.sh" "README.md" "dist/*" "*.zip" ".DS_Store" "**/.DS_Store"
echo "Built $OUT"
