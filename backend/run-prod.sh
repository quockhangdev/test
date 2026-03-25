#!/usr/bin/env bash
set -euo pipefail

# Chạy backend Flask ở chế độ production (Gunicorn).
# Dùng từ thư mục repo: ./backend/run-prod.sh hoặc cd backend && ./run-prod.sh
#
# Biến môi trường (tuỳ chọn):
#   HOST       — mặc định 0.0.0.0
#   PORT       — mặc định 5000
#   WORKERS    — số worker Gunicorn, mặc định 4
#   FLASK_ENV  — nên đặt production (mặc định script set production)
#
# Cần: pip install -r requirements.txt (có gunicorn)

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
WORKERS="${WORKERS:-4}"

exec gunicorn \
  --bind "${HOST}:${PORT}" \
  --workers "${WORKERS}" \
  'app:create_app()'
