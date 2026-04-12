from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId


def parse_oid(s: str | None) -> ObjectId | None:
    if not s:
        return None
    try:
        return ObjectId(str(s))
    except (InvalidId, TypeError):
        return None


def oid_str(oid) -> str:
    return "" if oid is None else str(oid)
