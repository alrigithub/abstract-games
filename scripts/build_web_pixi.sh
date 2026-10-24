#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT}/web-pixi"
npm install
npm run build

echo "Done. Pixi bundles in ${ROOT}/web/{yinsh,gomoku,boop,tak,tzaar}-pixi/"
