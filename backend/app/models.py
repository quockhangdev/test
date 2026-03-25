from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import UniqueConstraint

from . import db


class Role(str, enum.Enum):
    ADMIN = "admin"
    STUDENT = "student"


class QuestionType(str, enum.Enum):
    MCQ = "mcq"
    TF_MULTI = "tf_multi"  # 1 phát biểu + nhiều ý đúng/sai


class Track(str, enum.Enum):
    APP = "app"  # Tin học ứng dụng
    CS = "cs"  # Khoa học máy tính


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=True)
    role = db.Column(db.String(20), nullable=False, default=Role.STUDENT.value)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class Exam(db.Model):
    __tablename__ = "exams"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_published = db.Column(db.Boolean, nullable=False, default=False)
    # null => không giới hạn thời gian
    duration_minutes = db.Column(db.Integer, nullable=True)
    # null => không có password
    access_password_hash = db.Column(db.String(255), nullable=True)
    # tags list as JSON string
    tags_json = db.Column(db.Text, nullable=False, default="[]")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    questions = db.relationship(
        "Question", backref="exam", lazy=True, cascade="all, delete-orphan"
    )


class Favorite(db.Model):
    __tablename__ = "favorites"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("user_id", "exam_id", name="uq_fav_user_exam"),)

    user = db.relationship("User", backref="favorites")
    exam = db.relationship("Exam", backref="favorites")


class Question(db.Model):
    __tablename__ = "questions"

    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.id"), nullable=False, index=True)
    part = db.Column(db.Integer, nullable=False)  # 1 hoặc 2
    track = db.Column(db.String(10), nullable=True)  # null cho part 1, app/cs cho part 2
    qtype = db.Column(db.String(20), nullable=False)  # mcq | tf_multi

    prompt_html = db.Column(db.Text, nullable=False)  # hỗ trợ HTML

    # Dữ liệu theo dạng JSON string (SQLite OK)
    # - MCQ: [{"label":"A","text_html":"..."}...]
    # - TF_MULTI items: [{"label":"A","text_html":"...","is_true":true}...]
    options_json = db.Column(db.Text, nullable=False, default="[]")

    # MCQ: correct_index (0..n-1), TF_MULTI: ignored (để null)
    correct_index = db.Column(db.Integer, nullable=True)

    explanation_html = db.Column(db.Text, nullable=True)
    points = db.Column(db.Float, nullable=False, default=1.0)

    order_in_exam = db.Column(db.Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint(
            "exam_id",
            "part",
            "track",
            "order_in_exam",
            name="uq_question_order_per_section",
        ),
    )


class Attempt(db.Model):
    __tablename__ = "attempts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.id"), nullable=False, index=True)

    track_chosen = db.Column(db.String(10), nullable=True)  # app/cs
    started_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=True)

    # answers_json:
    # {
    #   "answers": {
    #     "<question_id>": { "type":"mcq","choiceIndex":1 }
    #     "<question_id>": { "type":"tf_multi","items":{"A":true,"B":false} }
    #   }
    # }
    answers_json = db.Column(db.Text, nullable=False, default='{"answers":{}}')

    score = db.Column(db.Float, nullable=True)

    user = db.relationship("User", backref="attempts")
    exam = db.relationship("Exam", backref="attempts")


class BlogPost(db.Model):
    __tablename__ = "blog_posts"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), nullable=False, unique=True, index=True)
    summary = db.Column(db.Text, nullable=True)
    content_markdown = db.Column(db.Text, nullable=False, default="")
    cover_image_url = db.Column(db.String(500), nullable=True)
    is_published = db.Column(db.Boolean, nullable=False, default=False)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    author = db.relationship("User", backref="blog_posts")

