import React, { useEffect, useMemo, useRef, useState } from "react";

/** Seeded permutation of 0..n-1 — stable for same seed (e.g. per attempt + question). */
function mcqDisplayOrder(seed: number, n: number): number[] {
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);
  const order = Array.from({ length: n }, (_, i) => i);
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), a | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function mcqDisplayLabel(displayIdx: number): string {
  return displayIdx < 26 ? String.fromCharCode(65 + displayIdx) : String(displayIdx + 1);
}

function hashStringToUint32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  IconButton,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Stack,
  TablePagination,
  TextField,
  Toolbar,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import { api } from "../lib/api";
import { formatAttemptDateTime } from "../lib/attemptUi";
import { useAuth } from "../lib/auth";
import { useExamTakingLayout } from "../lib/examTakingLayout";
import { SafeHtml } from "../components/SafeHtml";

function parseIsoMaybeUtc(s: string): number {
  // backend may send naive ISO; treat it as UTC by appending 'Z'
  const trimmed = s.trim();
  const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed);
  return Date.parse(hasTz ? trimmed : `${trimmed}Z`);
}

type Q =
  | {
      id: string;
      part: 1 | 2;
      track: "app" | "cs" | null;
      qtype: "mcq";
      prompt_html: string;
      options: Array<{ label: string; text_html: string }>;
      points: number;
    }
  | {
      id: string;
      part: 1 | 2;
      track: "app" | "cs" | null;
      qtype: "tf_multi";
      prompt_html: string;
      items: Array<{ label: string; text_html: string }>;
      points: number;
    };

function trackLabel(t: "app" | "cs" | null | undefined): string {
  if (t === "app") return "Tin học ứng dụng";
  if (t === "cs") return "Khoa học máy tính";
  return "—";
}

function isQuestionAnswered(q: Q, answers: Record<string, any>): boolean {
  const v = answers[String(q.id)];
  if (!v) return false;
  if (q.qtype === "mcq") {
    const idx = (v as any).choiceIndex;
    if (!Number.isFinite(idx)) return false;
    return idx >= 0 && idx < q.options.length;
  }
  if (q.qtype === "tf_multi") {
    const itemsAns = (v as any).items;
    if (!itemsAns || typeof itemsAns !== "object") return false;
    return q.items.every((it) => Object.prototype.hasOwnProperty.call(itemsAns, it.label));
  }
  return false;
}

function formatErrMessage(code: string): { severity: "error" | "warning"; text: string } {
  switch (code) {
    case "exam_password_required":
      return { severity: "warning", text: "Đề này có mật khẩu. Vui lòng nhập mật khẩu để bắt đầu." };
    case "exam_password_invalid":
      return { severity: "error", text: "Mật khẩu đề không đúng. Vui lòng kiểm tra và nhập lại." };
    case "missing_track":
      return { severity: "warning", text: "Vui lòng chọn định hướng (Tin học ứng dụng / Khoa học máy tính)." };
    case "time_up":
      return { severity: "warning", text: "Hết giờ làm bài. Bạn có thể bấm Bắt đầu để làm lại (tạo lượt mới)." };
    default:
      return { severity: "error", text: code };
  }
}

export default function TakeExam() {
  const { examId } = useParams();
  const { token, user } = useAuth();
  const { setTakingExam } = useExamTakingLayout();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [fatalErr, setFatalErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [questions, setQuestions] = useState<Q[]>([]);

  const [track, setTrack] = useState<"app" | "cs" | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(null);
  const [examPassword, setExamPassword] = useState<string>("");
  const [starting, setStarting] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [openHistory, setOpenHistory] = useState(false);
  const [historyRows, setHistoryRows] = useState<any[] | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRpp, setHistoryRpp] = useState(5);
  const [openReview, setOpenReview] = useState(false);
  const [review, setReview] = useState<any | null>(null);
  const [openResume, setOpenResume] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<{
    track?: "app" | "cs" | null;
    attemptId?: string | null;
    expiresAt?: string | null;
    answers?: Record<string, any>;
    activeIdx?: number;
  } | null>(null);
  const [resumeTimeLeftSec, setResumeTimeLeftSec] = useState<number | null>(null);

  // answers payload aligns backend grading
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [score, setScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showScoreSplash, setShowScoreSplash] = useState(false);
  const [openIncompleteSubmit, setOpenIncompleteSubmit] = useState(false);

  const arrowKeyHintShownForAttemptRef = useRef<string | null>(null);
  const [arrowKeyHintOpen, setArrowKeyHintOpen] = useState(false);

  const draftKey = useMemo(() => {
    if (!user?.id || !examId) return null;
    return `attempt_draft_${user.id}_${examId}`;
  }, [user?.id, examId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token || !examId) return;
        const ex = await api.getExam(token, examId);
        if (!alive) return;
        setTitle(ex.title);
        setDescription(ex.description);
        setDurationMinutes(ex.duration_minutes ?? null);
        setRequiresPassword(!!ex.requires_password);
        setQuestions(ex.questions as any);
      } catch (e: any) {
        if (alive) setFatalErr(e?.message || "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, examId]);

  useEffect(() => {
    setTakingExam(!!attemptId);
    return () => setTakingExam(false);
  }, [attemptId, setTakingExam]);

  const { part1, part2Common, part2app, part2cs } = useMemo(() => {
    const p1: Q[] = [];
    const p2common: Q[] = [];
    const p2a: Q[] = [];
    const p2c: Q[] = [];
    for (const q of questions) {
      if (q.part === 1) {
        p1.push(q);
        continue;
      }
      if (q.part === 2 && q.track === null) {
        // part 2.1: câu hỏi chung
        p2common.push(q);
        continue;
      }
      // part 2.2: câu hỏi theo chủ đề
      if (q.track === "app") p2a.push(q);
      else if (q.track === "cs") p2c.push(q);
    }
    return { part1: p1, part2Common: p2common, part2app: p2a, part2cs: p2c };
  }, [questions]);

  const part2List = track === "app" ? part2app : track === "cs" ? part2cs : [];

  const visibleQuestions = useMemo(() => {
    return [...part1, ...part2Common, ...(track ? part2List : [])];
  }, [part1, part2Common, part2List, track]);

  useEffect(() => {
    // reset index when question set changes
    setActiveIdx(0);
  }, [track, questions.length]);

  const activeQ = visibleQuestions[activeIdx] || null;
  const activeNumber = activeIdx + 1;

  function isAnswered(q: Q): boolean {
    return isQuestionAnswered(q, answers);
  }

  const incompleteSubmitInfo = useMemo(() => {
    const unansweredNumbers: number[] = [];
    for (let i = 0; i < visibleQuestions.length; i++) {
      if (!isQuestionAnswered(visibleQuestions[i], answers)) unansweredNumbers.push(i + 1);
    }
    return {
      unansweredCount: unansweredNumbers.length,
      unansweredNumbers
    };
  }, [visibleQuestions, answers]);

  useEffect(() => {
    if (!attemptId) return;
    const n = visibleQuestions.length;
    if (n === 0) return;
    const maxIdx = n - 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = e.target as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (el.isContentEditable) return;
        if (el.closest('[role="dialog"]')) return;
        if (el.closest('[role="menu"]')) return;
        if (el.closest('[role="listbox"]')) return;
        if (el.closest('[role="radiogroup"]')) return;
      }
      e.preventDefault();
      if (e.key === "ArrowLeft") setActiveIdx((i) => Math.max(0, i - 1));
      else setActiveIdx((i) => Math.min(maxIdx, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attemptId, visibleQuestions.length]);

  useEffect(() => {
    if (!attemptId || visibleQuestions.length <= 1) {
      if (!attemptId) arrowKeyHintShownForAttemptRef.current = null;
      return;
    }
    if (arrowKeyHintShownForAttemptRef.current === attemptId) return;
    arrowKeyHintShownForAttemptRef.current = attemptId;
    setArrowKeyHintOpen(true);
  }, [attemptId, visibleQuestions.length]);

  // restore draft after exam loaded
  useEffect(() => {
    if (loading) return;
    if (!draftKey) return;
    if (attemptId) return; // already in-progress
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        track?: "app" | "cs" | null;
        attemptId?: string | null;
        expiresAt?: string | null;
        answers?: Record<string, any>;
        activeIdx?: number;
      };
      setResumeDraft(draft);
      if (draft.expiresAt) {
        const ms = parseIsoMaybeUtc(draft.expiresAt) - Date.now();
        setResumeTimeLeftSec(Math.max(0, Math.floor(ms / 1000)));
      } else {
        setResumeTimeLeftSec(null);
      }
      setOpenResume(true);
    } catch {
      // ignore corrupted draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, draftKey]);

  function applyDraft(draft: {
    track?: "app" | "cs" | null;
    attemptId?: string | null;
    expiresAt?: string | null;
    answers?: Record<string, any>;
    activeIdx?: number;
  }) {
    if (draft.track) setTrack(draft.track);
    if (draft.attemptId) setAttemptId(draft.attemptId);
    if (draft.expiresAt) {
      setExpiresAt(draft.expiresAt);
      const ms = parseIsoMaybeUtc(draft.expiresAt) - Date.now();
      setTimeLeftSec(Math.max(0, Math.floor(ms / 1000)));
    }
    if (draft.answers) setAnswers(draft.answers);
    if (Number.isFinite(draft.activeIdx)) setActiveIdx(Math.max(0, Number(draft.activeIdx)));
  }

  function clearAttemptState() {
    setAttemptId(null);
    setExpiresAt(null);
    setTimeLeftSec(null);
    setScore(null);
    setSubmitting(false);
    setStarting(false);
    setAnswers({});
    setActiveIdx(0);
    setShowScoreSplash(false);
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }
  }

  /** Sau khi nộp thành công: kết thúc lượt làm (không còn attempt), giữ điểm cho popup. */
  function endSessionAfterSubmit() {
    setAttemptId(null);
    setExpiresAt(null);
    setTimeLeftSec(null);
    setSubmitting(false);
    setStarting(false);
    setAnswers({});
    setActiveIdx(0);
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }
  }

  /** Làm lại từ đầu: xóa hết trạng thái lượt trước (kể cả điểm hiển thị). */
  function beginRetake() {
    clearAttemptState();
    setErr(null);
  }

  async function performSubmit() {
    if (!token || !attemptId) return;
    try {
      setSubmitting(true);
      setErr(null);
      setOpenIncompleteSubmit(false);
      const res = await api.submitAttempt(token, attemptId, answers);
      setScore(res.score);
      setShowScoreSplash(true);
      endSessionAfterSubmit();
    } catch (e: any) {
      const msg = e?.message || "submit_failed";
      setErr(msg);
      if (msg === "time_up") clearAttemptState();
    } finally {
      setSubmitting(false);
    }
  }

  function requestSubmit() {
    if (incompleteSubmitInfo.unansweredCount > 0) {
      setOpenIncompleteSubmit(true);
      return;
    }
    void performSubmit();
  }

  // persist draft during attempt
  useEffect(() => {
    if (!draftKey) return;
    if (!attemptId) return;
    if (score !== null) return;
    try {
      const payload = JSON.stringify({
        track,
        attemptId,
        expiresAt,
        answers,
        activeIdx
      });
      localStorage.setItem(draftKey, payload);
    } catch {
      // ignore quota
    }
  }, [draftKey, attemptId, track, expiresAt, answers, activeIdx, score]);

  // clear draft on submit
  useEffect(() => {
    if (!draftKey) return;
    if (score === null) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }, [draftKey, score]);

  async function startIfNeeded() {
    if (!token) throw new Error("no_token");
    if (!track) throw new Error("missing_track");
    if (attemptId) return attemptId;
    const res = await api.startAttempt(token, examId!, track, requiresPassword ? examPassword : undefined);
    setScore(null);
    setShowScoreSplash(false);
    setAttemptId(res.attempt_id);
    setExpiresAt(res.expires_at);
    if (res.expires_at) {
      const ms = parseIsoMaybeUtc(res.expires_at) - Date.now();
      setTimeLeftSec(Math.max(0, Math.floor(ms / 1000)));
    } else {
      setTimeLeftSec(null);
    }
    return res.attempt_id;
  }

  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => {
      const ms = parseIsoMaybeUtc(expiresAt) - Date.now();
      const sec = Math.max(0, Math.floor(ms / 1000));
      setTimeLeftSec(sec);
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  useEffect(() => {
    if (!attemptId) return;
    if (score !== null) return;
    if (!expiresAt) return;
    if (timeLeftSec === null) return;
    if (timeLeftSec > 0) return;
    // If we restored an already-expired attempt, don't auto-submit; reset state so user can start again.
    const ms = parseIsoMaybeUtc(expiresAt) - Date.now();
    if (ms <= 0) {
      setErr("time_up");
      clearAttemptState();
      return;
    }
    // auto submit when time is up (không hỏi câu chưa làm — hết giờ là nộp)
    void performSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeftSec, attemptId, score, expiresAt, token, answers]);

  const started = !!attemptId;
  const pagedHistory = useMemo(() => {
    const rows = historyRows || [];
    const start = historyPage * historyRpp;
    return rows.slice(start, start + historyRpp);
  }, [historyRows, historyPage, historyRpp]);

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ p: 2 }}>
          <Typography color="text.secondary">Đang tải đề...</Typography>
        </CardContent>
      </Card>
    );
  }
  if (fatalErr) return <Alert severity="error">{fatalErr}</Alert>;

  const errUi = err ? formatErrMessage(err) : null;

  return (
    <Box
      sx={{
        width: "100%",
        ...(started && {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0
        })
      }}
    >
    <Stack spacing={2} sx={{ ...(started ? { flex: 1, minHeight: 0 } : { px: { xs: 1, sm: 2 } }) }}>
      <Dialog
        open={openResume}
        onClose={() => setOpenResume(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography fontWeight={800}>Tiếp tục bài làm?</Typography>
            <IconButton
              onClick={() => {
                setOpenResume(false);
                setResumeDraft(null);
                setResumeTimeLeftSec(null);
              }}
            >
              <CloseOutlinedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography color="text.secondary" variant="body2">
              Phát hiện bạn có dữ liệu làm bài trước đó đã lưu trên máy này.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {resumeDraft?.track && (
                <Chip size="small" variant="outlined" label={`Định hướng: ${trackLabel(resumeDraft.track)}`} />
              )}
              {resumeDraft?.attemptId && (
                <Chip size="small" variant="outlined" label="Lượt làm đang dở (đã lưu trên máy)" />
              )}
              {resumeTimeLeftSec !== null && (
                <Chip
                  size="small"
                  variant="outlined"
                  color={resumeTimeLeftSec <= 0 ? "warning" : "default"}
                  label={
                    resumeTimeLeftSec <= 0
                      ? "Đã hết giờ"
                      : `Còn: ${Math.floor(resumeTimeLeftSec / 60)
                          .toString()
                          .padStart(2, "0")}:${(resumeTimeLeftSec % 60).toString().padStart(2, "0")}`
                  }
                />
              )}
            </Stack>
            {resumeTimeLeftSec !== null && resumeTimeLeftSec <= 0 && (
              <Alert severity="warning">
                Dữ liệu cũ đã hết giờ nên không thể tiếp tục. Bạn có thể làm mới để bắt đầu lượt mới.
              </Alert>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                color="error"
                onClick={() => {
                  clearAttemptState();
                  setOpenResume(false);
                  setResumeDraft(null);
                  setResumeTimeLeftSec(null);
                  setErr(null);
                }}
              >
                Làm mới
              </Button>
              <Button
                variant="contained"
                disabled={!resumeDraft || (resumeTimeLeftSec !== null && resumeTimeLeftSec <= 0)}
                onClick={() => {
                  if (resumeDraft) applyDraft(resumeDraft);
                  setOpenResume(false);
                  setResumeDraft(null);
                  setResumeTimeLeftSec(null);
                  setErr(null);
                }}
              >
                Tiếp tục
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showScoreSplash && score !== null}
        onClose={() => setShowScoreSplash(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="score-splash-title"
        PaperProps={{
          elevation: 8,
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            background: (theme) =>
              theme.palette.mode === "dark"
                ? `linear-gradient(160deg, ${theme.palette.grey[900]} 0%, ${theme.palette.primary.dark}33 100%)`
                : `linear-gradient(160deg, ${theme.palette.background.paper} 0%, ${theme.palette.primary.light}22 55%, ${theme.palette.background.paper} 100%)`
          }
        }}
      >
        <DialogContent sx={{ px: { xs: 2, sm: 4 }, py: { xs: 4, sm: 5 }, textAlign: "center" }}>
          <Stack spacing={2.5} alignItems="center">
            <Typography id="score-splash-title" variant="overline" color="text.secondary" letterSpacing={2} fontWeight={700}>
              Kết quả
            </Typography>
            <Typography
              component="p"
              sx={{
                fontWeight: 900,
                lineHeight: 1.05,
                fontSize: { xs: "clamp(3rem, 14vw, 4.5rem)", sm: "clamp(3.5rem, 10vw, 5.5rem)" },
                color: "primary.main",
                textShadow: (theme) =>
                  theme.palette.mode === "dark" ? "0 0 40px rgba(144,202,249,0.25)" : "none"
              }}
            >
              {score !== null ? score.toFixed(2) : "—"}
            </Typography>
            <Typography variant="h6" fontWeight={600} color="text.primary">
              điểm
            </Typography>
            <Typography color="text.secondary" variant="body2" sx={{ maxWidth: 360 }}>
              Bài làm đã kết thúc. Bạn có thể làm lại từ đầu (lượt làm mới) bất cứ lúc nào.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1, width: "100%", maxWidth: 400 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<ReplayRoundedIcon />}
                onClick={() => {
                  beginRetake();
                }}
              >
                Làm lại từ đầu
              </Button>
              <Button fullWidth variant="outlined" size="large" onClick={() => setShowScoreSplash(false)}>
                Đóng
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openIncompleteSubmit}
        onClose={() => setOpenIncompleteSubmit(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="incomplete-submit-title"
      >
        <DialogTitle id="incomplete-submit-title">
          <Typography fontWeight={800}>Chưa làm hết bài</Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              Bạn còn <strong>{incompleteSubmitInfo.unansweredCount}</strong> câu chưa trả lời trên tổng{" "}
              <strong>{visibleQuestions.length}</strong> câu. Bạn có thể quay lại làm tiếp hoặc vẫn nộp bài (các câu
              chưa làm sẽ không được tính điểm).
            </Alert>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Câu chưa làm:
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
              {incompleteSubmitInfo.unansweredNumbers.map((n) => (
                <Chip key={n} size="small" label={`Câu ${n}`} color="warning" variant="outlined" />
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            onClick={() => {
              const first = incompleteSubmitInfo.unansweredNumbers[0];
              if (first !== undefined) setActiveIdx(first - 1);
              setOpenIncompleteSubmit(false);
            }}
          >
            Quay lại làm bài
          </Button>
          <Button variant="contained" color="warning" onClick={() => void performSubmit()} disabled={submitting}>
            {submitting ? "Đang nộp..." : "Vẫn nộp bài"}
          </Button>
        </DialogActions>
      </Dialog>

      {score !== null && !attemptId && !showScoreSplash && (
        <Card variant="outlined">
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography fontWeight={800}>Kết quả vừa rồi</Typography>
                <Chip color="success" variant="outlined" label={`${score.toFixed(2)} điểm`} />
              </Stack>
              <Button variant="outlined" size="small" startIcon={<ReplayRoundedIcon />} onClick={beginRetake}>
                Làm lại từ đầu
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {!started ? (
        <Card>
          <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
            <Stack spacing={1.25}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} justifyContent="space-between">
                <Stack spacing={0.25}>
                  <Typography fontWeight={900} variant="body1">
                    {title}
                  </Typography>
                  {description && (
                    <Typography color="text.secondary" variant="body2">
                      {description}
                    </Typography>
                  )}
                </Stack>
                <Button variant="outlined" size="small" onClick={() => nav("/")} startIcon={<HomeOutlinedIcon />}>
                  Về trang chủ
                </Button>
              </Stack>
              <Divider />
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
                {err && (
                  <Alert severity={errUi!.severity} sx={{ flex: 1 }}>
                    {errUi!.text}
                  </Alert>
                )}
                <Chip
                  label={
                    durationMinutes
                      ? `Thời gian đề: ${durationMinutes} phút`
                      : "Thời gian đề: không giới hạn"
                  }
                  size="small"
                  variant="outlined"
                />
                <FormControl sx={{ minWidth: 240, maxWidth: 360 }} size="small">
                  <InputLabel id="track-label">Định hướng</InputLabel>
                  <Select
                    labelId="track-label"
                    label="Định hướng"
                    value={track || ""}
                    onChange={(e) => {
                      const v = e.target.value as any;
                      setTrack(v || null);
                      setAttemptId(null);
                      setExpiresAt(null);
                      setTimeLeftSec(null);
                      setScore(null);
                      setShowScoreSplash(false);
                      if (draftKey) {
                        try {
                          localStorage.removeItem(draftKey);
                        } catch {
                          // ignore
                        }
                      }
                    }}
                  >
                    <MenuItem value="">
                      <em>-- Chọn định hướng --</em>
                    </MenuItem>
                    <MenuItem value="app">Tin học ứng dụng</MenuItem>
                    <MenuItem value="cs">Khoa học máy tính</MenuItem>
                  </Select>
                </FormControl>
                {track && (
                  <Typography color="text.secondary" variant="body2">
                    Chỉ làm <b>1</b> định hướng.
                  </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<HistoryOutlinedIcon />}
                  onClick={async () => {
                    try {
                      setOpenHistory(true);
                      setHistoryBusy(true);
                      setHistoryPage(0);
                      const rows = await api.listMyAttempts(token!, examId!);
                      setHistoryRows(rows);
                    } catch (e: any) {
                      setErr(e?.message || "history_failed");
                    } finally {
                      setHistoryBusy(false);
                    }
                  }}
                >
                  Lịch sử
                </Button>
              </Stack>
              <Divider />
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} justifyContent="space-between">
                <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                  {requiresPassword && (
                    <TextField
                      size="small"
                      type="password"
                      label="Password đề"
                      value={examPassword}
                      onChange={(e) => setExamPassword(e.target.value)}
                      sx={{ minWidth: 220 }}
                    />
                  )}
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayArrowRoundedIcon />}
                    disabled={!track || starting || (requiresPassword && !examPassword) || !!attemptId}
                    onClick={async () => {
                      try {
                        setStarting(true);
                        setErr(null);
                        await startIfNeeded();
                      } catch (e: any) {
                        setErr(e?.message || "start_failed");
                      } finally {
                        setStarting(false);
                      }
                    }}
                  >
                    {attemptId ? "Đã bắt đầu" : starting ? "Đang bắt đầu..." : "Bắt đầu"}
                  </Button>
                </Stack>
                <Typography color="text.secondary" variant="body2">
                  {attemptId ? "Bạn đang làm bài." : "Bấm Bắt đầu để hiển thị câu hỏi."}
                </Typography>
              </Stack>
              <Divider />
              <Alert severity="info">
                Bấm <b>Bắt đầu</b> để vào bài thi.
              </Alert>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <>
          <AppBar
            position="fixed"
            color="default"
            elevation={1}
            sx={{
              zIndex: (theme) => theme.zIndex.appBar,
              bgcolor: "background.paper",
              borderBottom: 1,
              borderColor: "divider"
            }}
          >
            <Toolbar
              variant="dense"
              sx={{
                gap: { xs: 0.5, sm: 1 },
                flexWrap: "wrap",
                px: { xs: 1, sm: 1.5 },
                py: 0.25,
                minHeight: 40
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={800} noWrap title={title} sx={{ fontSize: "0.8125rem" }}>
                  {title}
                </Typography>
                {track && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={trackLabel(track)}
                    sx={{ display: { xs: "none", sm: "inline-flex" } }}
                  />
                )}
              </Stack>
              <Box sx={{ flexShrink: 0, minWidth: { xs: 56, sm: 72 }, textAlign: "center" }}>
                {expiresAt && timeLeftSec !== null ? (
                  <Typography
                    sx={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      fontSize: { xs: "0.8125rem", sm: "0.9rem" },
                      color: timeLeftSec <= 60 ? "warning.main" : "text.primary"
                    }}
                  >
                    {`${Math.floor(timeLeftSec / 60)
                      .toString()
                      .padStart(2, "0")}:${(timeLeftSec % 60).toString().padStart(2, "0")}`}
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    Không giới hạn
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={submitting || !track || !attemptId}
                  startIcon={<SendOutlinedIcon />}
                  onClick={() => requestSubmit()}
                >
                  {submitting ? "Đang nộp..." : "Nộp bài"}
                </Button>
                <IconButton size="small" edge="end" onClick={() => nav("/")} aria-label="Về trang chủ" color="inherit">
                  <HomeOutlinedIcon />
                </IconButton>
              </Stack>
            </Toolbar>
          </AppBar>
          <Toolbar variant="dense" sx={{ minHeight: 40 }} />
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
          >
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                px: { xs: 1, sm: 1.5 },
                pt: 0,
                pb:
                  visibleQuestions.length > 0
                    ? "calc(96px + env(safe-area-inset-bottom, 0px))"
                    : { xs: 1.5, sm: 1.5 }
              }}
            >
              {err && (
                <Alert severity={errUi!.severity} sx={{ mb: 1, py: 0.5, flexShrink: 0 }}>
                  {errUi!.text}
                </Alert>
              )}
              {visibleQuestions.length === 0 ? (
                <Alert severity="info">Chưa có câu hỏi cho đề này.</Alert>
              ) : (
                <Container maxWidth="lg" sx={{ py: { xs: 0.5, sm: 0.75 } }}>
                  {activeQ ? (
                    <QuestionView
                      key={activeQ.id}
                      index={activeNumber}
                      q={activeQ}
                      value={answers[String(activeQ.id)]}
                      onChange={(v) => setAnswers((a) => ({ ...a, [String(activeQ.id)]: v }))}
                      mcqShuffleSeed={hashStringToUint32(
                        attemptId != null ? `a:${attemptId}:${activeQ.id}` : `e:${examId}:${activeQ.id}`
                      )}
                    />
                  ) : (
                    <Alert severity="info">Không có câu hỏi.</Alert>
                  )}
                </Container>
              )}
            </Box>
          </Box>
          {visibleQuestions.length > 0 && (
            <Paper
              component="nav"
              aria-label="Chuyển câu hỏi"
              elevation={8}
              square
              sx={(theme) => ({
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: theme.zIndex.appBar - 1,
                borderTop: 1,
                borderColor: "divider",
                background:
                  theme.palette.mode === "dark"
                    ? `linear-gradient(180deg, ${theme.palette.grey[900]}f2 0%, ${theme.palette.background.paper} 100%)`
                    : `linear-gradient(180deg, ${theme.palette.grey[50]} 0%, ${theme.palette.background.paper} 100%)`,
                pt: 0.75,
                pb: `calc(8px + env(safe-area-inset-bottom, 0px))`,
                boxShadow: theme.shadows[8]
              })}
            >
              <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2 } }}>
                <Stack spacing={0.75}>
                  <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch", mx: { xs: -0.25, sm: 0 } }}>
                    <Stack direction="row" useFlexGap flexWrap="nowrap" gap={0.375} sx={{ width: "max-content", minWidth: 0 }}>
                      {visibleQuestions.map((qItem, idx) => {
                        const active = activeIdx === idx;
                        const answered = isAnswered(qItem);
                        return (
                          <Button
                            key={qItem.id}
                            size="small"
                            variant={active ? "contained" : "outlined"}
                            color={answered ? "success" : "primary"}
                            disableElevation
                            onClick={() => setActiveIdx(idx)}
                            sx={{
                              flexShrink: 0,
                              minWidth: 30,
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              px: 0.5,
                              py: 0.25,
                              lineHeight: 1.2,
                              borderRadius: 1
                            }}
                          >
                            {idx + 1}
                          </Button>
                        );
                      })}
                    </Stack>
                  </Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={0.75} flexWrap="nowrap">
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={activeIdx <= 0}
                      onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                      sx={{ borderRadius: 99, minWidth: 0, px: 1, py: 0.25, fontSize: "0.75rem" }}
                    >
                      ← Trước
                    </Button>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        flex: 1,
                        textAlign: "center",
                        minWidth: 0,
                        lineHeight: 1.25,
                        fontSize: "0.7rem",
                        display: "block"
                      }}
                    >
                      {activeQ ? (
                        <>
                          Câu <strong>{activeNumber}</strong>/{visibleQuestions.length}
                          {" · "}
                          {activeQ.part === 1
                            ? "P.1"
                            : activeQ.track === null
                              ? "P.2.1"
                              : activeQ.track === "app"
                                ? "P.2.2 · Ứng dụng"
                                : "P.2.2 · KHMT"}
                        </>
                      ) : null}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={activeIdx >= visibleQuestions.length - 1}
                      onClick={() => setActiveIdx((i) => Math.min(visibleQuestions.length - 1, i + 1))}
                      sx={{ borderRadius: 99, minWidth: 0, px: 1, py: 0.25, fontSize: "0.75rem" }}
                    >
                      Sau →
                    </Button>
                  </Stack>
                </Stack>
              </Container>
            </Paper>
          )}
          <Snackbar
            open={arrowKeyHintOpen && visibleQuestions.length > 1}
            autoHideDuration={5000}
            onClose={() => setArrowKeyHintOpen(false)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            sx={{
              right: { xs: 8, sm: 12 },
              left: "auto",
              bottom: { xs: "calc(88px + env(safe-area-inset-bottom, 0px))", sm: "calc(88px + env(safe-area-inset-bottom, 0px))" }
            }}
          >
            <Paper
              elevation={0}
              sx={{
                px: 1.25,
                py: 0.75,
                maxWidth: 300,
                borderRadius: 1,
                border: 1,
                borderColor: "divider",
                bgcolor: "background.default",
                boxShadow: "none"
              }}
            >
              <Typography variant="body2" sx={{ fontSize: "0.78rem", lineHeight: 1.35, color: "text.secondary" }}>
                Bạn có thể dùng phím <strong>←</strong> <strong>→</strong> để chuyển câu.
              </Typography>
            </Paper>
          </Snackbar>
        </>
      )}

      {/* Part 2 is integrated into single-question mode via navigation */}

      <Dialog open={openHistory} onClose={() => setOpenHistory(false)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography fontWeight={800}>Lịch sử làm bài</Typography>
            <IconButton onClick={() => setOpenHistory(false)}>
              <CloseOutlinedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {historyBusy && <Typography color="text.secondary">Đang tải...</Typography>}
          {!historyBusy && (!historyRows || historyRows.length === 0) && (
            <Alert severity="info">Chưa có lần làm bài nào.</Alert>
          )}
          {!historyBusy && historyRows && historyRows.length > 0 && (
            <Stack spacing={1}>
              {pagedHistory.map((r, idx) => {
                const startedLabel = formatAttemptDateTime(r.started_at);
                return (
                <Card key={r.id} variant="outlined">
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} justifyContent="space-between">
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Lượt ${historyPage * historyRpp + idx + 1}`}
                          title={startedLabel ? `Bắt đầu: ${startedLabel}` : undefined}
                        />
                        <Chip size="small" variant="outlined" label={`Định hướng: ${trackLabel(r.track_chosen)}`} />
                        <Chip size="small" variant="outlined" label={r.submitted_at ? "Đã nộp" : "Chưa nộp"} color={r.submitted_at ? "success" : "default"} />
                        {r.score !== null && <Chip size="small" variant="outlined" label={`Điểm: ${Number(r.score).toFixed(2)}`} color="success" />}
                      </Stack>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={!r.submitted_at}
                        onClick={async () => {
                          try {
                            const detail = await api.getAttempt(token!, r.id);
                            setReview(detail);
                            setOpenReview(true);
                          } catch (e: any) {
                            setErr(e?.message || "load_attempt_failed");
                          }
                        }}
                      >
                        Xem lại
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              );
              })}
              <TablePagination
                component="div"
                count={historyRows.length}
                page={historyPage}
                onPageChange={(_, p) => setHistoryPage(p)}
                rowsPerPage={historyRpp}
                onRowsPerPageChange={(e) => {
                  setHistoryRpp(parseInt(e.target.value, 10));
                  setHistoryPage(0);
                }}
                rowsPerPageOptions={[5, 10, 20]}
                labelRowsPerPage="Dòng/trang"
              />
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openReview} onClose={() => setOpenReview(false)} fullWidth maxWidth="lg">
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography fontWeight={800}>Xem lại bài làm</Typography>
            <IconButton onClick={() => setOpenReview(false)}>
              <CloseOutlinedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {!review ? (
            <Typography color="text.secondary">Đang tải...</Typography>
          ) : (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(() => {
                  const s = formatAttemptDateTime(review.started_at);
                  return s ? <Chip size="small" variant="outlined" label={`Bắt đầu: ${s}`} /> : null;
                })()}
                {review.score !== null && <Chip size="small" color="success" variant="outlined" label={`Điểm: ${Number(review.score).toFixed(2)}`} />}
                {review.track_chosen && <Chip size="small" variant="outlined" label={`Định hướng: ${trackLabel(review.track_chosen)}`} />}
              </Stack>
              <Divider />
              <Stack spacing={1.5}>
                {(review.questions || []).map((q: any, idx: number) => (
                  <Card key={q.id} variant="outlined">
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Chip size="small" variant="outlined" label={`Câu ${idx + 1}`} />
                          <Chip size="small" variant="outlined" label={`${q.earned_points?.toFixed?.(2) ?? q.earned_points}/${q.points}`} color="success" />
                          {/* <Chip size="small" variant="outlined" label={`Type: ${q.qtype}`} /> */}
                        </Stack>
                        <SafeHtml html={q.prompt_html} />
                        <Divider />
                        {q.qtype === "mcq" ? (
                          <Stack spacing={0.5}>
                            {(q.options || []).map((o: any, i: number) => {
                              const ua = q.user_answer?.choiceIndex;
                              const isCorrect = q.correct_index === i;
                              const isPicked = ua === i;
                              return (
                                <Stack key={o.label} direction="row" spacing={1} alignItems="center">
                                  <Chip size="small" label={o.label} variant="outlined" />
                                  {isCorrect && <Chip size="small" color="success" label="Đúng" />}
                                  {isPicked && <Chip size="small" color={isCorrect ? "success" : "warning"} label="Bạn chọn" />}
                                  <Box sx={{ flex: 1 }}>
                                    <SafeHtml html={o.text_html} />
                                  </Box>
                                </Stack>
                              );
                            })}
                          </Stack>
                        ) : (
                          <Stack spacing={0.75}>
                            {(q.items || []).map((it: any) => {
                              const ua = q.user_answer?.items?.[it.label];
                              const ok = ua === it.is_true;
                              return (
                                <Stack key={it.label} direction="row" spacing={1} alignItems="center">
                                  <Chip size="small" label={it.label} variant="outlined" />
                                  <Chip size="small" label={it.is_true ? "Đúng" : "Sai"} color="success" variant="outlined" />
                                  {ua !== undefined && (
                                    <Chip size="small" label={`Bạn: ${ua ? "Đúng" : "Sai"}`} color={ok ? "success" : "warning"} />
                                  )}
                                  <Box sx={{ flex: 1 }}>
                                    <SafeHtml html={it.text_html} />
                                  </Box>
                                </Stack>
                              );
                            })}
                          </Stack>
                        )}
                        {q.explanation_html && (
                          <>
                            <Divider />
                            <SafeHtml html={q.explanation_html} />
                          </>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
    </Box>
  );
}

function QuestionView({
  q,
  index,
  value,
  onChange,
  mcqShuffleSeed
}: {
  q: Q;
  index: number;
  value: any;
  onChange: (v: any) => void;
  mcqShuffleSeed: number;
}) {
  const mcqOrder = useMemo(
    () => (q.qtype === "mcq" ? mcqDisplayOrder(mcqShuffleSeed, q.options.length) : []),
    [q, mcqShuffleSeed]
  );

  return (
    <Card variant="outlined" sx={{ width: 1 }}>
      <CardContent sx={{ p: { xs: 1, sm: 1.25 }, "&:last-child": { pb: { xs: 1, sm: 1.25 } } }}>
        <Stack spacing={0.75}>
          <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Typography fontWeight={800} variant="body2" sx={{ fontSize: "0.875rem" }}>
              Câu {index}
            </Typography>
            <Typography color="text.secondary" variant="caption">
              ({q.points}đ)
            </Typography>
          </Stack>
          <SafeHtml html={q.prompt_html} />
          <Divider sx={{ my: 0 }} />
          {q.qtype === "mcq" ? (
            <Stack spacing={0.5} role="radiogroup" aria-label="Đáp án">
              {mcqOrder.map((origIdx, displayIdx) => {
                const opt = q.options[origIdx];
                const checked = value?.choiceIndex === origIdx;
                return (
                  <Box
                    key={origIdx}
                    onClick={() => onChange({ type: "mcq", choiceIndex: origIdx })}
                    sx={(theme) => ({
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 0.75,
                      p: 1,
                      borderRadius: 1.5,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: checked ? "primary.main" : "divider",
                      bgcolor: checked ? alpha(theme.palette.primary.main, 0.06) : "background.paper",
                      transition: theme.transitions.create(["border-color", "background-color"], {
                        duration: theme.transitions.duration.shorter
                      }),
                      "&:hover": {
                        bgcolor: checked ? alpha(theme.palette.primary.main, 0.09) : "action.hover",
                        borderColor: checked ? "primary.main" : "action.focus"
                      }
                    })}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                      <Radio
                        size="small"
                        checked={checked}
                        onChange={() => onChange({ type: "mcq", choiceIndex: origIdx })}
                      />
                      <Chip label={mcqDisplayLabel(displayIdx)} size="small" variant="outlined" />
                    </Stack>
                    <Box
                      sx={(theme) => ({
                        flex: 1,
                        minWidth: 0,
                        pt: theme.spacing(0.75),
                        "& .safe-html-root > :first-child": { marginTop: 0 },
                        "& .safe-html-root p:first-of-type": { marginTop: 0 },
                        "& .safe-html-root > ul:first-child, & .safe-html-root > ol:first-child": { marginTop: 0 }
                      })}
                    >
                      <SafeHtml html={opt.text_html} />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Stack spacing={0.5}>
              {q.items.map((it) => {
                const current = value?.items?.[it.label];
                const answered = current === true || current === false;
                return (
                  <Box
                    key={it.label}
                    sx={(theme) => ({
                      border: "1px solid",
                      borderRadius: 1.5,
                      p: 1,
                      borderColor: answered ? "primary.main" : "divider",
                      bgcolor: answered ? alpha(theme.palette.primary.main, 0.06) : "background.paper",
                      transition: theme.transitions.create(["border-color", "background-color"], {
                        duration: theme.transitions.duration.shorter
                      }),
                      "&:hover": {
                        bgcolor: answered ? alpha(theme.palette.primary.main, 0.09) : "action.hover",
                        borderColor: answered ? "primary.main" : "action.focus"
                      }
                    })}
                  >
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        alignItems: "start",
                        columnGap: 0.75,
                        rowGap: 0.75
                      }}
                    >
                      <Chip
                        label={it.label}
                        size="small"
                        variant="outlined"
                        sx={(theme) => ({ flexShrink: 0, mt: theme.spacing(0.75), height: 24, fontSize: "0.7rem" })}
                      />
                      <Box
                        sx={(theme) => ({
                          minWidth: 0,
                          pt: theme.spacing(0.75),
                          "& .safe-html-root > :first-child": { marginTop: 0 },
                          "& .safe-html-root p:first-of-type": { marginTop: 0 },
                          "& .safe-html-root > ul:first-child, & .safe-html-root > ol:first-child": { marginTop: 0 }
                        })}
                      >
                        <SafeHtml html={it.text_html} />
                      </Box>
                      <RadioGroup
                        row
                        value={current === true ? "true" : current === false ? "false" : ""}
                        onChange={(_: React.ChangeEvent<HTMLInputElement>, v: string) =>
                          onChange({
                            type: "tf_multi",
                            items: { ...(value?.items || {}), [it.label]: v === "true" }
                          })
                        }
                        sx={{ gridColumn: 2, flexWrap: "wrap", gap: 0.5 }}
                      >
                        <FormControlLabel value="true" control={<Radio size="small" />} label="Đúng" />
                        <FormControlLabel value="false" control={<Radio size="small" />} label="Sai" />
                      </RadioGroup>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

