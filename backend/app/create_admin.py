from __future__ import annotations

import argparse

from . import create_app, db
from .models import Role, User
from .security import hash_password


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--full-name", default="Admin")
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        email = args.email.lower().strip()
        existing = User.query.filter_by(email=email).first()
        if existing:
            existing.password_hash = hash_password(args.password)
            existing.role = Role.ADMIN.value
            existing.full_name = args.full_name
            db.session.commit()
            print("Updated existing user to admin.")
            return

        user = User(
            email=email,
            password_hash=hash_password(args.password),
            role=Role.ADMIN.value,
            full_name=args.full_name,
        )
        db.session.add(user)
        db.session.commit()
        print("Admin created.")


if __name__ == "__main__":
    main()

