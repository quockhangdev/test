from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    full_name: str | None = Field(default=None, max_length=255)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ExamUpsertIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    is_published: bool = False
    duration_minutes: int | None = Field(default=None, ge=1, le=600)
    # Nếu gửi chuỗi rỗng => xoá password
    access_password: str | None = Field(default=None, max_length=200)


class QuestionOption(BaseModel):
    label: str
    text_html: str


class TfItem(BaseModel):
    label: str
    text_html: str
    is_true: bool


class QuestionUpsertIn(BaseModel):
    part: Literal[1, 2]
    track: Literal["app", "cs"] | None = None
    qtype: Literal["mcq", "tf_multi"]
    prompt_html: str
    explanation_html: str | None = None
    points: float = 1.0
    order_in_exam: int = 0

    # mcq
    options: list[QuestionOption] = Field(default_factory=list)
    correct_index: int | None = None

    # tf_multi
    items: list[TfItem] = Field(default_factory=list)


class AttemptStartIn(BaseModel):
    track_chosen: Literal["app", "cs"]
    access_password: str | None = None


class AttemptSubmitIn(BaseModel):
    answers: dict[str, Any]

