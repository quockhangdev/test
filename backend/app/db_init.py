from __future__ import annotations

import os

from mongoengine import connect

from .models import Attempt, Exam, Favorite, Question, User


def main():
    mongo_uri = os.environ.get("MONGODB_URI", "mongodb://127.0.0.1:27017/onthitinhoc")
    connect(host=mongo_uri, alias="default")
    User.ensure_indexes()
    Exam.ensure_indexes()
    Favorite.ensure_indexes()
    Question.ensure_indexes()
    Attempt.ensure_indexes()
    print("MongoDB indexes ensured.")


if __name__ == "__main__":
    main()
