from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from pydantic import ValidationError

from . import db
from .models import Attempt, BlogPost, Exam, Favorite, Question, Role, Track, User
from .schemas import (
    AttemptStartIn,
    AttemptSubmitIn,
    AdminUserUpdateIn,
    BlogPostUpsertIn,
    ExamUpsertIn,
    LoginIn,
    QuestionUpsertIn,
    RegisterIn,
)
from .security import hash_password, require_role, verify_password
from werkzeug.security import check_password_hash, generate_password_hash
from .utils import json_dumps, json_loads

api_bp = Blueprint("api", __name__)


def _pydantic(model_cls):
    try:
        return model_cls.model_validate(request.get_json(force=True))
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.errors()}), 400


def _slugify(s: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", (s or "").strip().lower()).strip("-")
    return slug[:255] or "post"


def _blog_post_row(p: BlogPost, include_content: bool = False):
    row = {
        "id": p.id,
        "title": p.title,
        "slug": p.slug,
        "summary": p.summary,
        "cover_image_url": p.cover_image_url,
        "is_published": p.is_published,
        "author": {
            "id": p.author.id,
            "email": p.author.email,
            "full_name": p.author.full_name,
        }
        if p.author
        else None,
        "created_at": p.created_at.isoformat() + "Z" if p.created_at else None,
        "updated_at": p.updated_at.isoformat() + "Z" if p.updated_at else None,
    }
    if include_content:
        row["content_markdown"] = p.content_markdown
    return row


@api_bp.get("/health")
def health():
    return jsonify({"ok": True})


@api_bp.post("/auth/register")
def register():
    payload = _pydantic(RegisterIn)
    if isinstance(payload, tuple):
        return payload

    existing = User.query.filter_by(email=str(payload.email).lower()).first()
    if existing:
        return jsonify({"error": "email_taken"}), 409

    user = User(
        email=str(payload.email).lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=Role.STUDENT.value,
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({"ok": True})


@api_bp.post("/auth/login")
def login():
    payload = _pydantic(LoginIn)
    if isinstance(payload, tuple):
        return payload

    user = User.query.filter_by(email=str(payload.email).lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        return jsonify({"error": "invalid_credentials"}), 401

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "email": user.email},
        expires_delta=timedelta(days=7),
    )
    return jsonify(
        {
            "access_token": access_token,
            "user": {"id": user.id, "email": user.email, "role": user.role, "full_name": user.full_name},
        }
    )


@api_bp.get("/me")
@jwt_required()
def me():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"id": user.id, "email": user.email, "role": user.role, "full_name": user.full_name})


# -------------------- Exams (public/student) --------------------


@api_bp.get("/exams")
@jwt_required(optional=True)
def list_exams():
    exams = Exam.query.filter_by(is_published=True).order_by(Exam.created_at.desc()).all()
    uid = None
    try:
        ident = get_jwt_identity()
        uid = int(ident) if ident is not None else None
    except Exception:
        uid = None
    fav_ids = set()
    if uid:
        fav_ids = {f.exam_id for f in Favorite.query.filter_by(user_id=uid).all()}
    return jsonify(
        [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "is_published": e.is_published,
                "duration_minutes": e.duration_minutes,
                "requires_password": bool(e.access_password_hash),
                "tags": json_loads(e.tags_json) or [],
                "is_favorite": (e.id in fav_ids) if uid else False,
                "created_at": e.created_at.isoformat(),
            }
            for e in exams
        ]
    )


@api_bp.get("/exams/<int:exam_id>")
@jwt_required()
def get_exam(exam_id: int):
    exam = Exam.query.get(exam_id)
    if not exam or not exam.is_published:
        return jsonify({"error": "not_found"}), 404

    # Trả về đề + câu hỏi nhưng KHÔNG lộ đáp án đúng
    questions = (
        Question.query.filter_by(exam_id=exam.id)
        .order_by(Question.part.asc(), Question.track.asc().nullsfirst(), Question.order_in_exam.asc())
        .all()
    )
    q_out = []
    for q in questions:
        payload = {
            "id": q.id,
            "part": q.part,
            "track": q.track,
            "qtype": q.qtype,
            "prompt_html": q.prompt_html,
            "points": q.points,
            "order_in_exam": q.order_in_exam,
            "explanation_html": q.explanation_html,
        }
        if q.qtype == "mcq":
            payload["options"] = json_loads(q.options_json) or []
        else:
            items = json_loads(q.options_json) or []
            payload["items"] = [{"label": i["label"], "text_html": i["text_html"]} for i in items]
        q_out.append(payload)

    return jsonify(
        {
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "duration_minutes": exam.duration_minutes,
            "requires_password": bool(exam.access_password_hash),
            "tags": json_loads(exam.tags_json) or [],
            "questions": q_out,
        }
    )


@api_bp.post("/exams/<int:exam_id>/favorite")
@jwt_required()
def favorite_exam(exam_id: int):
    exam = Exam.query.get(exam_id)
    if not exam or not exam.is_published:
        return jsonify({"error": "not_found"}), 404
    uid = int(get_jwt_identity())
    existing = Favorite.query.filter_by(user_id=uid, exam_id=exam_id).first()
    if existing:
        return jsonify({"ok": True, "is_favorite": True})
    fav = Favorite(user_id=uid, exam_id=exam_id)
    db.session.add(fav)
    db.session.commit()
    return jsonify({"ok": True, "is_favorite": True})


@api_bp.delete("/exams/<int:exam_id>/favorite")
@jwt_required()
def unfavorite_exam(exam_id: int):
    uid = int(get_jwt_identity())
    existing = Favorite.query.filter_by(user_id=uid, exam_id=exam_id).first()
    if not existing:
        return jsonify({"ok": True, "is_favorite": False})
    db.session.delete(existing)
    db.session.commit()
    return jsonify({"ok": True, "is_favorite": False})


@api_bp.post("/exams/<int:exam_id>/attempts/start")
@jwt_required()
def start_attempt(exam_id: int):
    exam = Exam.query.get(exam_id)
    if not exam or not exam.is_published:
        return jsonify({"error": "not_found"}), 404

    payload = _pydantic(AttemptStartIn)
    if isinstance(payload, tuple):
        return payload

    if exam.access_password_hash:
        if not payload.access_password:
            return jsonify({"error": "exam_password_required"}), 400
        if not check_password_hash(exam.access_password_hash, payload.access_password):
            return jsonify({"error": "exam_password_invalid"}), 401

    uid = int(get_jwt_identity())
    now = datetime.utcnow()
    expires_at = None
    if exam.duration_minutes:
        expires_at = now + timedelta(minutes=int(exam.duration_minutes))
    attempt = Attempt(
        user_id=uid,
        exam_id=exam.id,
        track_chosen=payload.track_chosen,
        started_at=now,
        expires_at=expires_at,
    )
    db.session.add(attempt)
    db.session.commit()
    return jsonify(
        {
            "attempt_id": attempt.id,
            "track_chosen": attempt.track_chosen,
            "expires_at": (attempt.expires_at.isoformat() + "Z") if attempt.expires_at else None,
            "duration_minutes": exam.duration_minutes,
        }
    )


def _grade_attempt(attempt: Attempt) -> float:
    answers = json_loads(attempt.answers_json) or {"answers": {}}
    answers_map = answers.get("answers", {}) or {}

    total = 0.0
    questions = Question.query.filter_by(exam_id=attempt.exam_id).all()
    q_by_id = {str(q.id): q for q in questions}

    for qid, ans in answers_map.items():
        q = q_by_id.get(str(qid))
        if not q:
            continue

        # enforce part 2 track
        if q.part == 2 and q.track and attempt.track_chosen and q.track != attempt.track_chosen:
            continue

        if q.qtype == "mcq":
            if not isinstance(ans, dict):
                continue
            if ans.get("choiceIndex") == q.correct_index:
                total += float(q.points)
        elif q.qtype == "tf_multi":
            # chấm theo từng ý: mỗi ý đúng/sai = điểm chia đều
            if not isinstance(ans, dict):
                continue
            items_ans = (ans.get("items") or {}) if isinstance(ans.get("items"), dict) else {}
            items = json_loads(q.options_json) or []
            if not items:
                continue
            per = float(q.points) / float(len(items))
            for it in items:
                label = it.get("label")
                if label is None:
                    continue
                if label in items_ans and bool(items_ans[label]) == bool(it.get("is_true")):
                    total += per
        else:
            continue

    return total


def _attempt_public_row(a: Attempt):
    return {
        "id": a.id,
        "exam_id": a.exam_id,
        "track_chosen": a.track_chosen,
        "started_at": a.started_at.isoformat() + "Z" if a.started_at else None,
        "expires_at": (a.expires_at.isoformat() + "Z") if a.expires_at else None,
        "submitted_at": (a.submitted_at.isoformat() + "Z") if a.submitted_at else None,
        "score": a.score,
    }


def _attempt_review_payload(a: Attempt):
    # includes correct answers (only after submit)
    answers = json_loads(a.answers_json) or {"answers": {}}
    answers_map = answers.get("answers", {}) or {}

    qs = (
        Question.query.filter_by(exam_id=a.exam_id)
        .order_by(Question.part.asc(), Question.track.asc().nullsfirst(), Question.order_in_exam.asc())
        .all()
    )

    out_questions = []
    for q in qs:
        if q.part == 2 and q.track and a.track_chosen and q.track != a.track_chosen:
            continue

        qid = str(q.id)
        user_ans = answers_map.get(qid)
        base = {
            "id": q.id,
            "part": q.part,
            "track": q.track,
            "qtype": q.qtype,
            "prompt_html": q.prompt_html,
            "points": q.points,
            "order_in_exam": q.order_in_exam,
            "explanation_html": q.explanation_html,
            "user_answer": user_ans,
        }

        earned = 0.0
        if q.qtype == "mcq":
            opts = json_loads(q.options_json) or []
            base["options"] = opts
            base["correct_index"] = q.correct_index
            if isinstance(user_ans, dict) and user_ans.get("choiceIndex") == q.correct_index:
                earned = float(q.points)
        else:
            items = json_loads(q.options_json) or []
            base["items"] = items  # includes is_true
            if isinstance(user_ans, dict):
                items_ans = (user_ans.get("items") or {}) if isinstance(user_ans.get("items"), dict) else {}
                if items:
                    per = float(q.points) / float(len(items))
                    for it in items:
                        label = it.get("label")
                        if label is None:
                            continue
                        if label in items_ans and bool(items_ans[label]) == bool(it.get("is_true")):
                            earned += per

        base["earned_points"] = earned
        out_questions.append(base)

    return {
        **_attempt_public_row(a),
        "answers": answers_map,
        "questions": out_questions,
    }


@api_bp.post("/attempts/<int:attempt_id>/submit")
@jwt_required()
def submit_attempt(attempt_id: int):
    uid = int(get_jwt_identity())
    attempt = Attempt.query.get(attempt_id)
    if not attempt or attempt.user_id != uid:
        return jsonify({"error": "not_found"}), 404
    if attempt.submitted_at is not None:
        return jsonify({"error": "already_submitted"}), 409

    if attempt.expires_at is not None and datetime.utcnow() > attempt.expires_at:
        return jsonify({"error": "time_up"}), 409

    payload = _pydantic(AttemptSubmitIn)
    if isinstance(payload, tuple):
        return payload

    attempt.answers_json = json_dumps({"answers": payload.answers})
    attempt.score = _grade_attempt(attempt)
    attempt.submitted_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"score": attempt.score})


@api_bp.get("/exams/<int:exam_id>/attempts")
@jwt_required()
def list_my_attempts(exam_id: int):
    uid = int(get_jwt_identity())
    rows = (
        Attempt.query.filter_by(user_id=uid, exam_id=exam_id)
        .order_by(Attempt.started_at.desc())
        .all()
    )
    return jsonify([_attempt_public_row(a) for a in rows])


@api_bp.get("/attempts/<int:attempt_id>")
@jwt_required()
def get_attempt_detail(attempt_id: int):
    uid = int(get_jwt_identity())
    a = Attempt.query.get(attempt_id)
    if not a or a.user_id != uid:
        return jsonify({"error": "not_found"}), 404
    if a.submitted_at is None:
        return jsonify({**_attempt_public_row(a), "submitted": False}), 200
    return jsonify({**_attempt_review_payload(a), "submitted": True})


# -------------------- Blog (authenticated readers) --------------------


@api_bp.get("/posts")
@jwt_required()
def list_posts():
    rows = (
        BlogPost.query.filter_by(is_published=True)
        .order_by(BlogPost.created_at.desc())
        .all()
    )
    return jsonify([_blog_post_row(p, include_content=False) for p in rows])


@api_bp.get("/posts/<string:slug_or_id>")
@jwt_required()
def get_post(slug_or_id: str):
    uid = int(get_jwt_identity())
    u = User.query.get(uid)
    is_admin = bool(u and u.role == Role.ADMIN.value)

    q = None
    if slug_or_id.isdigit():
        q = BlogPost.query.get(int(slug_or_id))
    if not q:
        q = BlogPost.query.filter_by(slug=slug_or_id).first()
    if not q:
        return jsonify({"error": "not_found"}), 404
    if not q.is_published and not is_admin:
        return jsonify({"error": "not_found"}), 404
    return jsonify(_blog_post_row(q, include_content=True))


# -------------------- Admin: CRUD exams/questions --------------------


@api_bp.get("/admin/exams")
@require_role(Role.ADMIN.value)
def admin_list_exams():
    exams = Exam.query.order_by(Exam.created_at.desc()).all()
    return jsonify(
        [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "is_published": e.is_published,
                "duration_minutes": e.duration_minutes,
                "requires_password": bool(e.access_password_hash),
                "tags": json_loads(e.tags_json) or [],
                "created_at": e.created_at.isoformat(),
                "updated_at": e.updated_at.isoformat(),
            }
            for e in exams
        ]
    )


@api_bp.post("/admin/exams")
@require_role(Role.ADMIN.value)
def admin_create_exam():
    payload = _pydantic(ExamUpsertIn)
    if isinstance(payload, tuple):
        return payload

    pw_hash = None
    if payload.access_password is not None:
        if payload.access_password.strip() != "":
            pw_hash = generate_password_hash(payload.access_password)
    exam = Exam(
        title=payload.title,
        description=payload.description,
        is_published=payload.is_published,
        duration_minutes=payload.duration_minutes,
        access_password_hash=pw_hash,
        tags_json=json_dumps(payload.tags or []),
    )
    db.session.add(exam)
    db.session.commit()
    return jsonify({"id": exam.id})


@api_bp.put("/admin/exams/<int:exam_id>")
@require_role(Role.ADMIN.value)
def admin_update_exam(exam_id: int):
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({"error": "not_found"}), 404
    payload = _pydantic(ExamUpsertIn)
    if isinstance(payload, tuple):
        return payload

    exam.title = payload.title
    exam.description = payload.description
    exam.is_published = payload.is_published
    exam.duration_minutes = payload.duration_minutes
    exam.tags_json = json_dumps(payload.tags or [])
    if payload.access_password is not None:
        if payload.access_password.strip() == "":
            exam.access_password_hash = None
        else:
            exam.access_password_hash = generate_password_hash(payload.access_password)
    db.session.commit()
    return jsonify({"ok": True})


@api_bp.delete("/admin/exams/<int:exam_id>")
@require_role(Role.ADMIN.value)
def admin_delete_exam(exam_id: int):
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({"error": "not_found"}), 404

    # If DB enforces FK constraints, deleting exam can fail when there are related rows
    # (e.g. attempts / favorites). We delete dependents explicitly first.
    try:
        Attempt.query.filter_by(exam_id=exam_id).delete(synchronize_session=False)
        Favorite.query.filter_by(exam_id=exam_id).delete(synchronize_session=False)
        Question.query.filter_by(exam_id=exam_id).delete(synchronize_session=False)
        # Ensure dependent deletes are applied before deleting parent (helps with FK enforcement)
        db.session.flush()
        db.session.delete(exam)
        db.session.flush()
        db.session.commit()
        return jsonify({"ok": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "delete_failed", "details": str(e)}), 500


@api_bp.get("/admin/exams/<int:exam_id>/questions")
@require_role(Role.ADMIN.value)
def admin_list_questions(exam_id: int):
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({"error": "not_found"}), 404
    questions = (
        Question.query.filter_by(exam_id=exam_id)
        .order_by(Question.part.asc(), Question.track.asc().nullsfirst(), Question.order_in_exam.asc())
        .all()
    )
    out = []
    for q in questions:
        row = {
            "id": q.id,
            "part": q.part,
            "track": q.track,
            "qtype": q.qtype,
            "prompt_html": q.prompt_html,
            "explanation_html": q.explanation_html,
            "points": q.points,
            "order_in_exam": q.order_in_exam,
        }
        if q.qtype == "mcq":
            row["options"] = json_loads(q.options_json) or []
            row["correct_index"] = q.correct_index
        else:
            row["items"] = json_loads(q.options_json) or []
        out.append(row)
    return jsonify(out)


@api_bp.post("/admin/exams/<int:exam_id>/questions")
@require_role(Role.ADMIN.value)
def admin_create_question(exam_id: int):
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({"error": "not_found"}), 404

    payload = _pydantic(QuestionUpsertIn)
    if isinstance(payload, tuple):
        return payload

    if payload.part == 1 and payload.track is not None:
        return jsonify({"error": "part1_track_must_be_null"}), 400
    # part 2 can be either:
    # - 2.1: track = None (câu hỏi chung)
    # - 2.2: track = app/cs (câu hỏi theo chủ đề)
    if payload.part == 2 and payload.track is not None and payload.track not in (Track.APP.value, Track.CS.value):
        return jsonify({"error": "invalid_track"}), 400

    if payload.qtype == "mcq":
        if payload.correct_index is None:
            return jsonify({"error": "correct_index_required"}), 400
        options = [o.model_dump() for o in payload.options]
        if not options:
            return jsonify({"error": "options_required"}), 400
        if payload.correct_index < 0 or payload.correct_index >= len(options):
            return jsonify({"error": "correct_index_out_of_range"}), 400
        options_json = json_dumps(options)
        correct_index = payload.correct_index
    else:
        items = [i.model_dump() for i in payload.items]
        if not items:
            return jsonify({"error": "items_required"}), 400
        options_json = json_dumps(items)
        correct_index = None

    q = Question(
        exam_id=exam_id,
        part=payload.part,
        track=payload.track,
        qtype=payload.qtype,
        prompt_html=payload.prompt_html,
        options_json=options_json,
        correct_index=correct_index,
        explanation_html=payload.explanation_html,
        points=payload.points,
        order_in_exam=payload.order_in_exam,
    )
    db.session.add(q)
    db.session.commit()
    return jsonify({"id": q.id})


@api_bp.put("/admin/questions/<int:question_id>")
@require_role(Role.ADMIN.value)
def admin_update_question(question_id: int):
    q = Question.query.get(question_id)
    if not q:
        return jsonify({"error": "not_found"}), 404

    payload = _pydantic(QuestionUpsertIn)
    if isinstance(payload, tuple):
        return payload

    if payload.part == 1 and payload.track is not None:
        return jsonify({"error": "part1_track_must_be_null"}), 400
    # part 2 can be either:
    # - 2.1: track = None (câu hỏi chung)
    # - 2.2: track = app/cs (câu hỏi theo chủ đề)
    if payload.part == 2 and payload.track is not None and payload.track not in (Track.APP.value, Track.CS.value):
        return jsonify({"error": "invalid_track"}), 400

    if payload.qtype == "mcq":
        options = [o.model_dump() for o in payload.options]
        if not options:
            return jsonify({"error": "options_required"}), 400
        if payload.correct_index is None:
            return jsonify({"error": "correct_index_required"}), 400
        if payload.correct_index < 0 or payload.correct_index >= len(options):
            return jsonify({"error": "correct_index_out_of_range"}), 400
        q.options_json = json_dumps(options)
        q.correct_index = payload.correct_index
    else:
        items = [i.model_dump() for i in payload.items]
        if not items:
            return jsonify({"error": "items_required"}), 400
        q.options_json = json_dumps(items)
        q.correct_index = None

    q.part = payload.part
    q.track = payload.track
    q.qtype = payload.qtype
    q.prompt_html = payload.prompt_html
    q.explanation_html = payload.explanation_html
    q.points = payload.points
    q.order_in_exam = payload.order_in_exam

    db.session.commit()
    return jsonify({"ok": True})


@api_bp.delete("/admin/questions/<int:question_id>")
@require_role(Role.ADMIN.value)
def admin_delete_question(question_id: int):
    q = Question.query.get(question_id)
    if not q:
        return jsonify({"error": "not_found"}), 404
    db.session.delete(q)
    db.session.commit()
    return jsonify({"ok": True})


@api_bp.get("/admin/attempts")
@require_role(Role.ADMIN.value)
def admin_list_attempts():
    exam_id = request.args.get("exam_id", type=int)
    user_id = request.args.get("user_id", type=int)

    q = Attempt.query
    if exam_id:
        q = q.filter(Attempt.exam_id == exam_id)
    if user_id:
        q = q.filter(Attempt.user_id == user_id)

    rows = q.order_by(Attempt.started_at.desc()).all()
    out = []
    for a in rows:
        u = User.query.get(a.user_id)
        out.append({**_attempt_public_row(a), "user": {"id": u.id, "email": u.email, "full_name": u.full_name} if u else None})
    return jsonify(out)


@api_bp.get("/admin/attempts/<int:attempt_id>")
@require_role(Role.ADMIN.value)
def admin_get_attempt_detail(attempt_id: int):
    a = Attempt.query.get(attempt_id)
    if not a:
        return jsonify({"error": "not_found"}), 404
    if a.submitted_at is None:
        return jsonify({**_attempt_public_row(a), "submitted": False}), 200
    u = User.query.get(a.user_id)
    return jsonify({**_attempt_review_payload(a), "submitted": True, "user": {"id": u.id, "email": u.email, "full_name": u.full_name} if u else None})


# -------------------- Admin: Blog --------------------


@api_bp.get("/admin/posts")
@require_role(Role.ADMIN.value)
def admin_list_posts():
    rows = BlogPost.query.order_by(BlogPost.created_at.desc()).all()
    return jsonify([_blog_post_row(p, include_content=True) for p in rows])


@api_bp.post("/admin/posts")
@require_role(Role.ADMIN.value)
def admin_create_post():
    payload = _pydantic(BlogPostUpsertIn)
    if isinstance(payload, tuple):
        return payload

    slug = _slugify(payload.slug)
    if BlogPost.query.filter_by(slug=slug).first():
        return jsonify({"error": "slug_taken"}), 409

    uid = int(get_jwt_identity())
    p = BlogPost(
        title=payload.title.strip(),
        slug=slug,
        summary=(payload.summary or "").strip() or None,
        content_markdown=payload.content_markdown or "",
        cover_image_url=(payload.cover_image_url or "").strip() or None,
        is_published=payload.is_published,
        author_id=uid,
    )
    db.session.add(p)
    db.session.commit()
    return jsonify({"id": p.id})


@api_bp.put("/admin/posts/<int:post_id>")
@require_role(Role.ADMIN.value)
def admin_update_post(post_id: int):
    p = BlogPost.query.get(post_id)
    if not p:
        return jsonify({"error": "not_found"}), 404

    payload = _pydantic(BlogPostUpsertIn)
    if isinstance(payload, tuple):
        return payload

    slug = _slugify(payload.slug)
    existing = BlogPost.query.filter(BlogPost.slug == slug, BlogPost.id != post_id).first()
    if existing:
        return jsonify({"error": "slug_taken"}), 409

    p.title = payload.title.strip()
    p.slug = slug
    p.summary = (payload.summary or "").strip() or None
    p.content_markdown = payload.content_markdown or ""
    p.cover_image_url = (payload.cover_image_url or "").strip() or None
    p.is_published = payload.is_published
    db.session.commit()
    return jsonify({"ok": True})


@api_bp.delete("/admin/posts/<int:post_id>")
@require_role(Role.ADMIN.value)
def admin_delete_post(post_id: int):
    p = BlogPost.query.get(post_id)
    if not p:
        return jsonify({"error": "not_found"}), 404
    db.session.delete(p)
    db.session.commit()
    return jsonify({"ok": True})


@api_bp.post("/admin/uploads/image")
@require_role(Role.ADMIN.value)
def admin_upload_image():
    f = request.files.get("image")
    if not f:
        return jsonify({"error": "file_required"}), 400

    filename = f.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        return jsonify({"error": "invalid_file_type"}), 400

    upload_dir = os.path.join(os.path.dirname(__file__), "static", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    saved_name = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(upload_dir, saved_name)
    f.save(save_path)

    url = request.host_url.rstrip("/") + f"/static/uploads/{saved_name}"
    return jsonify({"url": url})


# -------------------- Admin: Users --------------------


def _user_public_row(u: User):
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "created_at": u.created_at.isoformat() + "Z" if u.created_at else None,
    }


@api_bp.get("/admin/users")
@require_role(Role.ADMIN.value)
def admin_list_users():
    q = (request.args.get("q") or "").strip().lower()
    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter((User.email.ilike(like)) | (User.full_name.ilike(like)))
    rows = query.order_by(User.created_at.desc()).all()
    return jsonify([_user_public_row(u) for u in rows])


@api_bp.patch("/admin/users/<int:user_id>")
@require_role(Role.ADMIN.value)
def admin_update_user(user_id: int):
    payload = _pydantic(AdminUserUpdateIn)
    if isinstance(payload, tuple):
        return payload

    uid = int(get_jwt_identity())
    target = User.query.get(user_id)
    if not target:
        return jsonify({"error": "not_found"}), 404

    if payload.role is not None and target.id == uid and payload.role != Role.ADMIN.value:
        return jsonify({"error": "cannot_demote_self"}), 400

    if payload.role is not None and target.role == Role.ADMIN.value and payload.role != Role.ADMIN.value:
        admins = User.query.filter_by(role=Role.ADMIN.value).count()
        if admins <= 1:
            return jsonify({"error": "cannot_remove_last_admin"}), 400
        target.role = payload.role

    if payload.full_name is not None:
        target.full_name = payload.full_name

    if payload.password is not None:
        target.password_hash = hash_password(payload.password)

    db.session.commit()
    return jsonify({"ok": True, "user": _user_public_row(target)})


@api_bp.delete("/admin/users/<int:user_id>")
@require_role(Role.ADMIN.value)
def admin_delete_user(user_id: int):
    uid = int(get_jwt_identity())
    if user_id == uid:
        return jsonify({"error": "cannot_delete_self"}), 400

    u = User.query.get(user_id)
    if not u:
        return jsonify({"error": "not_found"}), 404

    if u.role == Role.ADMIN.value:
        admins = User.query.filter_by(role=Role.ADMIN.value).count()
        if admins <= 1:
            return jsonify({"error": "cannot_delete_last_admin"}), 400

    db.session.delete(u)
    db.session.commit()
    return jsonify({"ok": True})

