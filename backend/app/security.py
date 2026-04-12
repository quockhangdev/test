from __future__ import annotations

from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request
from werkzeug.security import check_password_hash, generate_password_hash

from .models import User


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, password)


def require_role(role: str):
    """Yêu cầu JWT hợp lệ và role khớp. Ưu tiên claim `role` trong token; nếu không khớp thì đọc role từ DB (tránh token cũ / thiếu claim sau đổi môi trường)."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if claims.get("role") == role:
                return fn(*args, **kwargs)
            ident = get_jwt_identity()
            if ident is not None:
                user = User.objects(id=str(ident)).first()
                if user and user.role == role:
                    return fn(*args, **kwargs)
            return jsonify({"error": "forbidden"}), 403

        return wrapper

    return decorator

