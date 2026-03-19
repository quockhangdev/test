from __future__ import annotations

from sqlalchemy import text

from . import create_app, db


def _sqlite_add_column_if_missing(table: str, column: str, ddl_type: str):
    # SQLite supports ALTER TABLE ADD COLUMN
    cols = db.session.execute(text(f"PRAGMA table_info({table})")).fetchall()
    existing = {row[1] for row in cols}  # row[1] is name
    if column in existing:
        return
    db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))


def main():
    app = create_app()
    with app.app_context():
        db.create_all()
        # lightweight migrations for existing sqlite db
        _sqlite_add_column_if_missing("exams", "duration_minutes", "INTEGER")
        _sqlite_add_column_if_missing("exams", "access_password_hash", "VARCHAR(255)")
        _sqlite_add_column_if_missing("attempts", "expires_at", "DATETIME")
        db.session.commit()
    print("DB initialized.")


if __name__ == "__main__":
    main()

