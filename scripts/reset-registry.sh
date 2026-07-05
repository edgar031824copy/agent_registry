#!/usr/bin/env bash
# Resets the registry to an empty state (safe to run while the server is up).
# Clears push/pull events and all stored manifests; keeps the DB file and schema.
set -euo pipefail

cd "$(dirname "$0")/.."

DB="server/data/registry.db"
MANIFESTS="server/data/manifests"

mkdir -p "$MANIFESTS"

if [ -f "$DB" ]; then
  sqlite3 "$DB" "DELETE FROM pushes; DELETE FROM pulls;"
  echo "✓ cleared pushes and pulls tables"
else
  echo "· no registry.db yet (will be created on server boot)"
fi

find "$MANIFESTS" -mindepth 1 ! -name '.gitkeep' -delete
echo "✓ cleared stored manifests"
echo "Registry is empty — ready for a fresh demo run."
