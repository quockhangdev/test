const API_BASE_DEFAULT = "http://127.0.0.1:5000/api";

/** Đặt trong `.env`: `VITE_API_BASE=http://127.0.0.1:5000/api` */
export const API_BASE = (import.meta.env.VITE_API_BASE?.trim() || API_BASE_DEFAULT).replace(/\/+$/, "");

export type ApiError = { error: string; details?: unknown };

/** MongoDB ObjectId hex từ API */
export type Id = string;

type HeaderMap = Record<string, string>;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...((init.headers || {}) as HeaderMap)
    } as HeaderMap
  });
  if (!res.ok) {
    let data: ApiError | null = null;
    try {
      data = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    const msg = data?.error || `http_${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, data });
  }
  return (await res.json()) as T;
}

async function requestRaw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let data: ApiError | null = null;
    try {
      data = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    const msg = data?.error || `http_${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, data });
  }
  return (await res.json()) as T;
}

export function authHeader(token: string | null): HeaderMap {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),

  register: (body: { email: string; password: string; full_name?: string }) =>
    request<{ ok: boolean }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<{
      access_token: string;
      user: { id: Id; email: string; role: "admin" | "student"; full_name: string | null };
    }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  me: (token: string) =>
    request<{ id: Id; email: string; role: string; full_name: string | null }>("/me", {
      headers: authHeader(token)
    }),

  listExams: (token: string) =>
    request<
      Array<{
        id: Id;
        title: string;
        description: string | null;
        duration_minutes: number | null;
        requires_password: boolean;
        tags: string[];
        is_favorite: boolean;
      }>
    >("/exams", {
      headers: authHeader(token)
    }),

  getExam: (token: string, examId: Id) =>
    request<{
      id: Id;
      title: string;
      description: string | null;
      duration_minutes: number | null;
      requires_password: boolean;
      tags: string[];
      questions: Array<
        | {
            id: Id;
            part: 1 | 2;
            track: "app" | "cs" | null;
            qtype: "mcq";
            prompt_html: string;
            options: Array<{ label: string; text_html: string }>;
            points: number;
            order_in_exam: number;
            explanation_html: string | null;
          }
        | {
            id: Id;
            part: 1 | 2;
            track: "app" | "cs" | null;
            qtype: "tf_multi";
            prompt_html: string;
            items: Array<{ label: string; text_html: string }>;
            points: number;
            order_in_exam: number;
            explanation_html: string | null;
          }
      >;
    }>(`/exams/${examId}`, { headers: authHeader(token) }),

  startAttempt: (token: string, examId: Id, track_chosen: "app" | "cs", access_password?: string) =>
    request<{ attempt_id: Id; track_chosen: "app" | "cs"; expires_at: string | null; duration_minutes: number | null }>(
      `/exams/${examId}/attempts/start`,
      {
        method: "POST",
        headers: authHeader(token),
        body: JSON.stringify({ track_chosen, access_password })
      }
    ),

  submitAttempt: (token: string, attemptId: Id, answers: Record<string, unknown>) =>
    request<{ score: number }>(`/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify({ answers })
    }),

  listMyAttempts: (token: string, examId: Id) =>
    request<Array<{ id: Id; exam_id: Id; track_chosen: "app" | "cs" | null; started_at: string; submitted_at: string | null; score: number | null }>>(
      `/exams/${examId}/attempts`,
      { headers: authHeader(token) }
    ),

  getAttempt: (token: string, attemptId: Id) => request<any>(`/attempts/${attemptId}`, { headers: authHeader(token) }),

  favoriteExam: (token: string, examId: Id) =>
    request<{ ok: boolean; is_favorite: boolean }>(`/exams/${examId}/favorite`, { method: "POST", headers: authHeader(token) }),
  unfavoriteExam: (token: string, examId: Id) =>
    request<{ ok: boolean; is_favorite: boolean }>(`/exams/${examId}/favorite`, { method: "DELETE", headers: authHeader(token) }),

  admin: {
    listExams: (token: string) =>
      request<
        Array<{
          id: Id;
          title: string;
          description: string | null;
          is_published: boolean;
          duration_minutes: number | null;
          requires_password: boolean;
          tags: string[];
        }>
      >("/admin/exams", {
        headers: authHeader(token)
      }),
    createExam: (
      token: string,
      body: { title: string; description?: string | null; is_published?: boolean; duration_minutes?: number | null; access_password?: string | null; tags?: string[] }
    ) =>
      request<{ id: Id }>("/admin/exams", {
        method: "POST",
        headers: authHeader(token),
        body: JSON.stringify(body)
      }),
    updateExam: (
      token: string,
      examId: Id,
      body: { title: string; description?: string | null; is_published?: boolean; duration_minutes?: number | null; access_password?: string | null; tags?: string[] }
    ) =>
      request<{ ok: boolean }>(`/admin/exams/${examId}`, {
        method: "PUT",
        headers: authHeader(token),
        body: JSON.stringify(body)
      }),
    deleteExam: (token: string, examId: Id) =>
      request<{ ok: boolean }>(`/admin/exams/${examId}`, { method: "DELETE", headers: authHeader(token) }),
    listQuestions: (token: string, examId: Id) => request<any[]>(`/admin/exams/${examId}/questions`, { headers: authHeader(token) }),
    createQuestion: (token: string, examId: Id, body: any) =>
      request<{ id: Id }>(`/admin/exams/${examId}/questions`, {
        method: "POST",
        headers: authHeader(token),
        body: JSON.stringify(body)
      }),
    updateQuestion: (token: string, questionId: Id, body: any) =>
      request<{ ok: boolean }>(`/admin/questions/${questionId}`, {
        method: "PUT",
        headers: authHeader(token),
        body: JSON.stringify(body)
      }),
    deleteQuestion: (token: string, questionId: Id) =>
      request<{ ok: boolean }>(`/admin/questions/${questionId}`, {
        method: "DELETE",
        headers: authHeader(token)
      }),

    listAttempts: (token: string, params: { exam_id?: Id; user_id?: Id } = {}) => {
      const qs = new URLSearchParams();
      if (params.exam_id) qs.set("exam_id", String(params.exam_id));
      if (params.user_id) qs.set("user_id", String(params.user_id));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<any[]>(`/admin/attempts${suffix}`, { headers: authHeader(token) });
    },
    getAttempt: (token: string, attemptId: Id) => request<any>(`/admin/attempts/${attemptId}`, { headers: authHeader(token) }),

    uploadImage: (token: string, file: File) => {
      const fd = new FormData();
      fd.append("image", file);
      return requestRaw<{ url: string }>(`/admin/uploads/image`, {
        method: "POST",
        headers: authHeader(token),
        body: fd
      });
    },

    listUsers: (token: string, params: { q?: string } = {}) => {
      const qs = new URLSearchParams();
      if (params.q) qs.set("q", params.q);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<Array<{ id: Id; email: string; full_name: string | null; role: "admin" | "student"; created_at: string | null }>>(
        `/admin/users${suffix}`,
        { headers: authHeader(token) }
      );
    },
    updateUser: (
      token: string,
      userId: Id,
      body: { full_name?: string | null; role?: "admin" | "student" | null; password?: string | null }
    ) =>
      request<{ ok: boolean; user: { id: Id; email: string; full_name: string | null; role: "admin" | "student"; created_at: string | null } }>(
        `/admin/users/${userId}`,
        { method: "PATCH", headers: authHeader(token), body: JSON.stringify(body) }
      ),
    deleteUser: (token: string, userId: Id) =>
      request<{ ok: boolean }>(`/admin/users/${userId}`, { method: "DELETE", headers: authHeader(token) })
  }
};
