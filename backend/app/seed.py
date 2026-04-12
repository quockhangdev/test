from __future__ import annotations

import os

from . import create_app
from .models import Exam, Question, Role, Track, User
from .security import hash_password
from .utils import json_dumps

# Tiêu đề đề dùng để nhận biết seed (idempotent — không tạo trùng khi chạy lại)
SEED_EXAM_TITLE = "Đề ôn mẫu (seed)"


def _ensure_indexes():
    User.ensure_indexes()
    Exam.ensure_indexes()
    Question.ensure_indexes()


def main():
    create_app()
    _ensure_indexes()

    admin_email = os.environ.get("SEED_ADMIN_EMAIL", "admin@localhost").lower().strip()
    admin_password = os.environ.get("SEED_ADMIN_PASSWORD", "admin123")
    student_email = os.environ.get("SEED_STUDENT_EMAIL", "student@localhost").lower().strip()
    student_password = os.environ.get("SEED_STUDENT_PASSWORD", "student123")

    if not User.objects(email=admin_email).first():
        User(
            email=admin_email,
            password_hash=hash_password(admin_password),
            full_name="Admin (seed)",
            role=Role.ADMIN.value,
        ).save()
        print(f"Created admin: {admin_email}")
    else:
        print(f"Skip admin (exists): {admin_email}")

    if not User.objects(email=student_email).first():
        User(
            email=student_email,
            password_hash=hash_password(student_password),
            full_name="Học sinh (seed)",
            role=Role.STUDENT.value,
        ).save()
        print(f"Created student: {student_email}")
    else:
        print(f"Skip student (exists): {student_email}")

    if Exam.objects(title=SEED_EXAM_TITLE).first():
        print("Skip sample exam (already seeded).")
        return

    exam = Exam(
        title=SEED_EXAM_TITLE,
        description="Đề minh hoạ do script seed tạo — có thể xoá trong admin.",
        is_published=True,
        duration_minutes=45,
        access_password_hash=None,
        tags=["seed", "demo"],
    )
    exam.save()

    mcq_opts = [
        {"label": "A", "text_html": "<p>Phương án A</p>"},
        {"label": "B", "text_html": "<p>Phương án B (đúng)</p>"},
        {"label": "C", "text_html": "<p>Phương án C</p>"},
        {"label": "D", "text_html": "<p>Phương án D</p>"},
    ]
    Question(
        exam=exam,
        part=1,
        track=None,
        qtype="mcq",
        prompt_html="<p><strong>Câu 1 (phần 1):</strong> Chọn đáp án đúng.</p>",
        options_json=json_dumps(mcq_opts),
        correct_index=1,
        explanation_html="<p>Đáp án mẫu: B.</p>",
        points=1.0,
        order_in_exam=0,
    ).save()

    tf_items = [
        {"label": "A", "text_html": "<p>Ý A</p>", "is_true": True},
        {"label": "B", "text_html": "<p>Ý B</p>", "is_true": False},
    ]
    Question(
        exam=exam,
        part=2,
        track=Track.APP.value,
        qtype="tf_multi",
        prompt_html="<p><strong>Câu 2 (phần 2 — Tin ứng dụng):</strong> Đánh dấu Đúng/Sai từng ý.</p>",
        options_json=json_dumps(tf_items),
        correct_index=None,
        explanation_html=None,
        points=1.0,
        order_in_exam=1,
    ).save()

    print(f"Created sample exam: {SEED_EXAM_TITLE} (id={exam.id})")


if __name__ == "__main__":
    main()
