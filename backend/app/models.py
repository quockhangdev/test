from __future__ import annotations

import enum
from datetime import datetime

from mongoengine import (
    CASCADE,
    BooleanField,
    DateTimeField,
    Document,
    FloatField,
    IntField,
    ListField,
    ReferenceField,
    StringField,
)


class Role(str, enum.Enum):
    ADMIN = "admin"
    STUDENT = "student"


class Track(str, enum.Enum):
    APP = "app"
    CS = "cs"


class User(Document):
    email = StringField(required=True, max_length=255, unique=True)
    password_hash = StringField(required=True, max_length=255)
    full_name = StringField(max_length=255, null=True)
    role = StringField(max_length=20, required=True, default=Role.STUDENT.value)
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "users",
        "indexes": [{"fields": ["email"], "unique": True}],
    }


class Exam(Document):
    title = StringField(required=True, max_length=255)
    description = StringField(null=True)
    is_published = BooleanField(default=False)
    duration_minutes = IntField(null=True)
    access_password_hash = StringField(max_length=255, null=True)
    tags = ListField(StringField(max_length=80), default=list)
    created_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "exams",
        "indexes": ["-created_at", "is_published"],
    }

    def clean(self):
        if self.tags is None:
            self.tags = []


class Favorite(Document):
    user = ReferenceField(User, required=True, reverse_delete_rule=CASCADE)
    exam = ReferenceField(Exam, required=True, reverse_delete_rule=CASCADE)
    created_at = DateTimeField(default=datetime.utcnow)

    meta = {
        "collection": "favorites",
        "indexes": [
            {"fields": ["user", "exam"], "unique": True},
            "user",
            "exam",
        ],
    }


class Question(Document):
    exam = ReferenceField(Exam, required=True, reverse_delete_rule=CASCADE)
    part = IntField(required=True)
    track = StringField(max_length=10, null=True)
    qtype = StringField(max_length=20, required=True)

    prompt_html = StringField(required=True)
    options_json = StringField(default="[]")
    correct_index = IntField(null=True)
    explanation_html = StringField(null=True)
    points = FloatField(required=True, default=1.0)
    order_in_exam = IntField(required=True, default=0)

    meta = {
        "collection": "questions",
        "indexes": ["exam", ("exam", "part", "order_in_exam")],
    }


class Attempt(Document):
    user = ReferenceField(User, required=True, reverse_delete_rule=CASCADE)
    exam = ReferenceField(Exam, required=True, reverse_delete_rule=CASCADE)
    track_chosen = StringField(max_length=10, null=True)
    started_at = DateTimeField(default=datetime.utcnow)
    expires_at = DateTimeField(null=True)
    submitted_at = DateTimeField(null=True)
    answers_json = StringField(default='{"answers":{}}')
    score = FloatField(null=True)

    meta = {
        "collection": "attempts",
        "indexes": [
            ("user", "exam"),
            "-started_at",
            "exam",
        ],
    }
