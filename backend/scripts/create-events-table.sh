#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -f "${BACKEND_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${BACKEND_DIR}/.env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Export it or add it to backend/.env."
  exit 1
fi

psql "${DATABASE_URL}" -f "${BACKEND_DIR}/prisma/manual/create-events-table.sql"
echo "Events table created/verified."
