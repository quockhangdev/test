#!/usr/bin/env bash
set -euo pipefail

# Chạy backend Flask production bằng Waitress (WSGI, đa luồng).
# Dùng từ repo: ./backend/run-prod.sh hoặc cd backend && ./run-prod.sh
#
# Biến môi trường (tuỳ chọn):
#   HOST       — mặc định 0.0.0.0
#   PORT       — mặc định 5000
#   THREADS    — số thread xử lý request, mặc định 4
#   FLASK_ENV  — nên đặt production (script set mặc định production)
#
# Cần: pip install -r requirements.txt (có waitress)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -d .venv ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
elif [[ -d venv ]]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi

export FLASK_ENV="${FLASK_ENV:-production}"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-5000}"
THREADS="${THREADS:-4}"

exec waitress-serve \
  --host="${HOST}" \
  --port="${PORT}" \
  --threads="${THREADS}" \
  --call \
  app:create_app
