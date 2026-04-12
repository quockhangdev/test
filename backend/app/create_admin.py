from __future__ import annotations

import argparse

from . import create_app
from .models import Role, User
from .security import hash_password


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--full-name", default="Admin")
    args = parser.parse_args()

    create_app()

    email = args.email.lower().strip()
    existing = User.objects(email=email).first()
    if existing:
        existing.password_hash = hash_password(args.password)
        existing.role = Role.ADMIN.value
        existing.full_name = args.full_name
        existing.save()
        print("Updated existing user to admin.")
        return

    user = User(
        email=email,
        password_hash=hash_password(args.password),
        role=Role.ADMIN.value,
        full_name=args.full_name,
    )
    user.save()
    print("Admin created.")


if __name__ == "__main__":
    main()
