from __future__ import annotations

import json


def json_dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def json_loads(text: str):
    return json.loads(text) if text else None

