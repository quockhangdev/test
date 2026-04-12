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
from werkzeug.security import check_password_hash, generate_password_hash

from .models import Attempt, Exam, Favorite, Question, Role, Track, User
from .oidutil import parse_oid
from .schemas import (
    AttemptStartIn,
    AttemptSubmitIn,
    AdminUserUpdateIn,
    ExamUpsertIn,
    LoginIn,
    QuestionUpsertIn,
    RegisterIn,
)
from .security import hash_password, require_role, verify_password
from .utils import json_dumps, json_loads

api_bp = Blueprint("api", __name__)


def _pydantic(model_cls):
    try:
        return model_cls.model_validate(request.get_json(force=True))
    except ValidationError as e:
        return jsonify({"error": "validation_error", "details": e.errors()}), 400


def question_sort_key(q: Question):
    return (q.part, 0 if q.track is None else 1, q.track or "", q.order_in_exam)


def _sorted_questions_for_exam(exam: Exam) -> list[Question]:
    qs = list(Question.objects(exam=exam))
    qs.sort(key=question_sort_key)
    return qs


def jwt_user_id_str() -> str:
    ident = get_jwt_identity()
    if ident is None:
        return ""
    return str(ident)


@api_bp.get("/health")
def health():
    return jsonify({"ok": True})


@api_bp.post("/auth/register")
def register():
    payload = _pydantic(RegisterIn)
    if isinstance(payload, tuple):
        return payload

    email = str(payload.email).lower()
    if User.objects(email=email).first():
        return jsonify({"error": "email_taken"}), 409

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=Role.STUDENT.value,
    )
    user.save()
    return jsonify({"ok": True})


@api_bp.post("/auth/login")
def login():
    payload = _pydantic(LoginIn)
    if isinstance(payload, tuple):
        return payload

    user = User.objects(email=str(payload.email).lower()).first()
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
            "user": {
                "id": str(user.id),
                "email": user.email,
                "role": user.role,
                "full_name": user.full_name,
            },
        }
    )


@api_bp.get("/me")
@jwt_required()
def me():
    uid = jwt_user_id_str()
    user = User.objects(id=uid).first()
    if not user:
        return jsonify({"error": "not_found"}), 404
    return jsonify(
        {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name,
        }
    )


@api_bp.get("/exams")
@jwt_required(optional=True)
def list_exams():
    exams = Exam.objects(is_published=True).order_by("-created_at")
    uid = None
    try:
        ident = get_jwt_identity()
        uid = str(ident) if ident is not None else None
    except Exception:
        uid = None

    fav_ids: set[str] = set()
    if uid:
        u = User.objects(id=uid).first()
        if u:
            fav_ids = {str(f.exam.id) for f in Favorite.objects(user=u).only("exam")}

    return jsonify(
        [
            {
                "id": str(e.id),
                "title": e.title,
                "description": e.description,
                "is_published": e.is_published,
                "duration_minutes": e.duration_minutes,
                "requires_password": bool(e.access_password_hash),
                "tags": e.tags or [],
                "is_favorite": (str(e.id) in fav_ids) if uid else False,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in exams
        ]
    )


@api_bp.get("/exams/<exam_id>")
@jwt_required()
def get_exam(exam_id: str):
    oid = parse_oid(exam_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    exam = Exam.objects(id=oid).first()
    if not exam or not exam.is_published:
        return jsonify({"error": "not_found"}), 404

    questions = _sorted_questions_for_exam(exam)
    q_out = []
    for q in questions:
        payload = {
            "id": str(q.id),
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
            "id": str(exam.id),
            "title": exam.title,
            "description": exam.description,
            "duration_minutes": exam.duration_minutes,
            "requires_password": bool(exam.access_password_hash),
            "tags": exam.tags or [],
            "questions": q_out,
        }
    )


@api_bp.post("/exams/<exam_id>/favorite")
@jwt_required()
def favorite_exam(exam_id: str):
    oid = parse_oid(exam_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    exam = Exam.objects(id=oid).first()
    if not exam or not exam.is_published:
        return jsonify({"error": "not_found"}), 404

    uid = jwt_user_id_str()
    user = User.objects(id=uid).first()
    if not user:
        return jsonify({"error": "not_found"}), 404

    if Favorite.objects(user=user, exam=exam).first():
        return jsonify({"ok": True, "is_favorite": True})

    Favorite(user=user, exam=exam).save()
    return jsonify({"ok": True, "is_favorite": True})


@api_bp.delete("/exams/<exam_id>/favorite")
@jwt_required()
def unfavorite_exam(exam_id: str):
    oid = parse_oid(exam_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    exam = Exam.objects(id=oid).first()
    if not exam:
        return jsonify({"error": "not_found"}), 404

    uid = jwt_user_id_str()
    user = User.objects(id=uid).first()
    if not user:
        return jsonify({"error": "not_found"}), 404

    existing = Favorite.objects(user=user, exam=exam).first()
    if not existing:
        return jsonify({"ok": True, "is_favorite": False})
    existing.delete()
    return jsonify({"ok": True, "is_favorite": False})


@api_bp.post("/exams/<exam_id>/attempts/start")
@jwt_required()
def start_attempt(exam_id: str):
    oid = parse_oid(exam_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    exam = Exam.objects(id=oid).first()
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

    uid = jwt_user_id_str()
    user = User.objects(id=uid).first()
    if not user:
        return jsonify({"error": "not_found"}), 404

    now = datetime.utcnow()
    expires_at = None
    if exam.duration_minutes:
        expires_at = now + timedelta(minutes=int(exam.duration_minutes))
    attempt = Attempt(
        user=user,
        exam=exam,
        track_chosen=payload.track_chosen,
        started_at=now,
        expires_at=expires_at,
    )
    attempt.save()
    return jsonify(
        {
            "attempt_id": str(attempt.id),
            "track_chosen": attempt.track_chosen,
            "expires_at": (attempt.expires_at.isoformat() + "Z") if attempt.expires_at else None,
            "duration_minutes": exam.duration_minutes,
        }
    )


def _grade_attempt(attempt: Attempt) -> float:
    answers = json_loads(attempt.answers_json) or {"answers": {}}
    answers_map = answers.get("answers", {}) or {}

    total = 0.0
    questions = _sorted_questions_for_exam(attempt.exam)
    q_by_id = {str(q.id): q for q in questions}

    for qid, ans in answers_map.items():
        q = q_by_id.get(str(qid))
        if not q:
            continue

        if q.part == 2 and q.track and attempt.track_chosen and q.track != attempt.track_chosen:
            continue

        if q.qtype == "mcq":
            if not isinstance(ans, dict):
                continue
            if ans.get("choiceIndex") == q.correct_index:
                total += float(q.points)
        elif q.qtype == "tf_multi":
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
        "id": str(a.id),
        "exam_id": str(a.exam.id),
        "track_chosen": a.track_chosen,
        "started_at": a.started_at.isoformat() + "Z" if a.started_at else None,
        "expires_at": (a.expires_at.isoformat() + "Z") if a.expires_at else None,
        "submitted_at": (a.submitted_at.isoformat() + "Z") if a.submitted_at else None,
        "score": a.score,
    }


def _attempt_review_payload(a: Attempt):
    answers = json_loads(a.answers_json) or {"answers": {}}
    answers_map = answers.get("answers", {}) or {}

    qs = _sorted_questions_for_exam(a.exam)

    out_questions = []
    for q in qs:
        if q.part == 2 and q.track and a.track_chosen and q.track != a.track_chosen:
            continue

        qid = str(q.id)
        user_ans = answers_map.get(qid)
        base = {
            "id": str(q.id),
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
            base["items"] = items
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


@api_bp.post("/attempts/<attempt_id>/submit")
@jwt_required()
def submit_attempt(attempt_id: str):
    uid = jwt_user_id_str()
    oid = parse_oid(attempt_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404

    attempt = Attempt.objects(id=oid).first()
    if not attempt or str(attempt.user.id) != uid:
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
    attempt.save()
    return jsonify({"score": attempt.score})


@api_bp.get("/exams/<exam_id>/attempts")
@jwt_required()
def list_my_attempts(exam_id: str):
    eid = parse_oid(exam_id)
    if not eid:
        return jsonify({"error": "not_found"}), 404
    exam = Exam.objects(id=eid).first()
    if not exam:
        return jsonify({"error": "not_found"}), 404

    uid = jwt_user_id_str()
    user = User.objects(id=uid).first()
    if not user:
        return jsonify({"error": "not_found"}), 404

    rows = Attempt.objects(user=user, exam=exam).order_by("-started_at")
    return jsonify([_attempt_public_row(a) for a in rows])


@api_bp.get("/attempts/<attempt_id>")
@jwt_required()
def get_attempt_detail(attempt_id: str):
    uid = jwt_user_id_str()
    oid = parse_oid(attempt_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    a = Attempt.objects(id=oid).first()
    if not a or str(a.user.id) != uid:
        return jsonify({"error": "not_found"}), 404
    if a.submitted_at is None:
        return jsonify({**_attempt_public_row(a), "submitted": False}), 200
    return jsonify({**_attempt_review_payload(a), "submitted": True})


@api_bp.get("/admin/exams")
@require_role(Role.ADMIN.value)
def admin_list_exams():
    exams = Exam.objects.order_by("-created_at")
    return jsonify(
        [
            {
                "id": str(e.id),
                "title": e.title,
                "description": e.description,
                "is_published": e.is_published,
                "duration_minutes": e.duration_minutes,
                "requires_password": bool(e.access_password_hash),
                "tags": e.tags or [],
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "updated_at": e.updated_at.isoformat() if e.updated_at else None,
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
    tags = [t.strip() for t in (payload.tags or []) if t and str(t).strip()][:20]
    exam = Exam(
        title=payload.title,
        description=payload.description,
        is_published=payload.is_published,
        duration_minutes=payload.duration_minutes,
        access_password_hash=pw_hash,
        tags=tags,
    )
    exam.save()
    return jsonify({"id": str(exam.id)})


@api_bp.put("/admin/exams/<exam_id>")
@require_role(Role.ADMIN.value)
def admin_update_exam(exam_id: str):
    oid = parse_oid(exam_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    exam = Exam.objects(id=oid).first()
    if not exam:
        return jsonify({"error": "not_found"}), 404

    payload = _pydantic(ExamUpsertIn)
    if isinstance(payload, tuple):
        return payload

    exam.title = payload.title
    exam.description = payload.description
    exam.is_published = payload.is_published
    exam.duration_minutes = payload.duration_minutes
    exam.tags = [t.strip() for t in (payload.tags or []) if t and str(t).strip()][:20]
    if payload.access_password is not None:
        if payload.access_password.strip() == "":
            exam.access_password_hash = None
        else:
            exam.access_password_hash = generate_password_hash(payload.access_password)
    exam.updated_at = datetime.utcnow()
    exam.save()
    return jsonify({"ok": True})


@api_bp.delete("/admin/exams/<exam_id>")
@require_role(Role.ADMIN.value)
def admin_delete_exam(exam_id: str):
    oid = parse_oid(exam_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    exam = Exam.objects(id=oid).first()
    if not exam:
        return jsonify({"error": "not_found"}), 404

    try:
        # MongoEngine đã đăng ký CASCADE từ Question / Attempt / Favorite → Exam; chỉ cần xoá Exam.
        exam.delete()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": "delete_failed", "details": str(e)}), 500


@api_bp.get("/admin/exams/<exam_id>/questions")
@require_role(Role.ADMIN.value)
def admin_list_questions(exam_id: str):
    oid = parse_oid(exam_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    exam = Exam.objects(id=oid).first()
    if not exam:
        return jsonify({"error": "not_found"}), 404

    questions = _sorted_questions_for_exam(exam)
    out = []
    for q in questions:
        row = {
            "id": str(q.id),
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


@api_bp.post("/admin/exams/<exam_id>/questions")
@require_role(Role.ADMIN.value)
def admin_create_question(exam_id: str):
    oid = parse_oid(exam_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    exam = Exam.objects(id=oid).first()
    if not exam:
        return jsonify({"error": "not_found"}), 404

    payload = _pydantic(QuestionUpsertIn)
    if isinstance(payload, tuple):
        return payload

    if payload.part == 1 and payload.track is not None:
        return jsonify({"error": "part1_track_must_be_null"}), 400
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
        exam=exam,
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
    q.save()
    return jsonify({"id": str(q.id)})


@api_bp.put("/admin/questions/<question_id>")
@require_role(Role.ADMIN.value)
def admin_update_question(question_id: str):
    oid = parse_oid(question_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    q = Question.objects(id=oid).first()
    if not q:
        return jsonify({"error": "not_found"}), 404

    payload = _pydantic(QuestionUpsertIn)
    if isinstance(payload, tuple):
        return payload

    if payload.part == 1 and payload.track is not None:
        return jsonify({"error": "part1_track_must_be_null"}), 400
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
    q.save()
    return jsonify({"ok": True})


@api_bp.delete("/admin/questions/<question_id>")
@require_role(Role.ADMIN.value)
def admin_delete_question(question_id: str):
    oid = parse_oid(question_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    q = Question.objects(id=oid).first()
    if not q:
        return jsonify({"error": "not_found"}), 404
    q.delete()
    return jsonify({"ok": True})


@api_bp.get("/admin/attempts")
@require_role(Role.ADMIN.value)
def admin_list_attempts():
    exam_id_raw = request.args.get("exam_id")
    user_id_raw = request.args.get("user_id")

    q = Attempt.objects
    if exam_id_raw:
        eoid = parse_oid(exam_id_raw)
        if eoid:
            ex = Exam.objects(id=eoid).first()
            if ex:
                q = q.filter(exam=ex)
    if user_id_raw:
        uoid = parse_oid(user_id_raw)
        if uoid:
            u = User.objects(id=uoid).first()
            if u:
                q = q.filter(user=u)

    rows = q.order_by("-started_at")
    out = []
    for a in rows:
        u = a.user
        out.append(
            {
                **_attempt_public_row(a),
                "user": {"id": str(u.id), "email": u.email, "full_name": u.full_name} if u else None,
            }
        )
    return jsonify(out)


@api_bp.get("/admin/attempts/<attempt_id>")
@require_role(Role.ADMIN.value)
def admin_get_attempt_detail(attempt_id: str):
    oid = parse_oid(attempt_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    a = Attempt.objects(id=oid).first()
    if not a:
        return jsonify({"error": "not_found"}), 404
    u = a.user
    user_row = {"id": str(u.id), "email": u.email, "full_name": u.full_name} if u else None
    if a.submitted_at is None:
        return jsonify({**_attempt_public_row(a), "submitted": False, "user": user_row}), 200
    return jsonify({**_attempt_review_payload(a), "submitted": True, "user": user_row})


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


def _user_public_row(u: User):
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "created_at": u.created_at.isoformat() + "Z" if u.created_at else None,
    }


@api_bp.get("/admin/users")
@require_role(Role.ADMIN.value)
def admin_list_users():
    q = (request.args.get("q") or "").strip().lower()
    if q:
        rows = User.objects(
            __raw__={
                "$or": [
                    {"email": {"$regex": re.escape(q), "$options": "i"}},
                    {"full_name": {"$regex": re.escape(q), "$options": "i"}},
                ]
            }
        ).order_by("-created_at")
    else:
        rows = User.objects.order_by("-created_at")
    return jsonify([_user_public_row(u) for u in rows])


@api_bp.patch("/admin/users/<user_id>")
@require_role(Role.ADMIN.value)
def admin_update_user(user_id: str):
    payload = _pydantic(AdminUserUpdateIn)
    if isinstance(payload, tuple):
        return payload

    uid = jwt_user_id_str()
    oid = parse_oid(user_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404
    target = User.objects(id=oid).first()
    if not target:
        return jsonify({"error": "not_found"}), 404

    if payload.role is not None and str(target.id) == uid and payload.role != Role.ADMIN.value:
        return jsonify({"error": "cannot_demote_self"}), 400

    if payload.role is not None and target.role == Role.ADMIN.value and payload.role != Role.ADMIN.value:
        admins = User.objects(role=Role.ADMIN.value).count()
        if admins <= 1:
            return jsonify({"error": "cannot_remove_last_admin"}), 400
        target.role = payload.role

    if payload.full_name is not None:
        target.full_name = payload.full_name

    if payload.password is not None:
        target.password_hash = hash_password(payload.password)

    target.save()
    return jsonify({"ok": True, "user": _user_public_row(target)})


@api_bp.delete("/admin/users/<user_id>")
@require_role(Role.ADMIN.value)
def admin_delete_user(user_id: str):
    uid = jwt_user_id_str()
    oid = parse_oid(user_id)
    if not oid:
        return jsonify({"error": "not_found"}), 404

    if str(oid) == uid:
        return jsonify({"error": "cannot_delete_self"}), 400

    u = User.objects(id=oid).first()
    if not u:
        return jsonify({"error": "not_found"}), 404

    if u.role == Role.ADMIN.value:
        admins = User.objects(role=Role.ADMIN.value).count()
        if admins <= 1:
            return jsonify({"error": "cannot_delete_last_admin"}), 400

    Attempt.objects(user=u).delete()
    Favorite.objects(user=u).delete()
    u.delete()
    return jsonify({"ok": True})
