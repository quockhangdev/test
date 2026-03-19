import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  TablePagination,
  TextField,
  Typography
} from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SafeHtml } from "../components/SafeHtml";

function parseIsoMaybeUtc(s: string): number {
  // backend may send naive ISO; treat it as UTC by appending 'Z'
  const trimmed = s.trim();
  const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed);
  return Date.parse(hasTz ? trimmed : `${trimmed}Z`);
}

type Q =
  | {
      id: number;
      part: 1 | 2;
      track: "app" | "cs" | null;
      qtype: "mcq";
      prompt_html: string;
      options: Array<{ label: string; text_html: string }>;
      points: number;
    }
  | {
      id: number;
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
  const [attemptId, setAttemptId] = useState<number | null>(null);
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
    attemptId?: number | null;
    expiresAt?: string | null;
    answers?: Record<string, any>;
    activeIdx?: number;
  } | null>(null);
  const [resumeTimeLeftSec, setResumeTimeLeftSec] = useState<number | null>(null);

  // answers payload aligns backend grading
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [score, setScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const draftKey = useMemo(() => {
    if (!user?.id || !examId) return null;
    return `attempt_draft_${user.id}_${examId}`;
  }, [user?.id, examId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token) return;
        const ex = await api.getExam(token, Number(examId));
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
      // Mark as done only when user has decided for all statements.
      return q.items.every((it) => Object.prototype.hasOwnProperty.call(itemsAns, it.label));
    }
    return false;
  }

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
        attemptId?: number | null;
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
    attemptId?: number | null;
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
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }
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
    const res = await api.startAttempt(token, Number(examId), track, requiresPassword ? examPassword : undefined);
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
    // auto submit when time is up
    (async () => {
      try {
        setSubmitting(true);
        setErr(null);
        const res = await api.submitAttempt(token!, attemptId, answers);
        setScore(res.score);
      } catch (e: any) {
        // backend may return time_up if already expired, keep UI stable
        const msg = e?.message || "time_up";
        setErr(msg);
        if (msg === "time_up") clearAttemptState();
      } finally {
        setSubmitting(false);
      }
    })();
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
    <Stack spacing={2}>
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
                <Chip size="small" variant="outlined" label={`Attempt #${resumeDraft.attemptId}`} />
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
                    ? `Thời gian: ${durationMinutes} phút`
                    : "Thời gian: không giới hạn"
                }
                size="small"
                variant="outlined"
              />
              {expiresAt && timeLeftSec !== null && (
                <Chip
                  color={timeLeftSec <= 60 ? "warning" : "default"}
                  label={`Còn: ${Math.floor(timeLeftSec / 60)
                    .toString()
                    .padStart(2, "0")}:${(timeLeftSec % 60).toString().padStart(2, "0")}`}
                  size="small"
                  variant="outlined"
                />
              )}
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
                    const rows = await api.listMyAttempts(token!, Number(examId));
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
            {!started ? (
              <Alert severity="info">Bấm <b>Bắt đầu</b> để vào bài thi.</Alert>
            ) : visibleQuestions.length === 0 ? (
              <Alert severity="info">Chưa có câu hỏi cho đề này.</Alert>
            ) : (
              <Grid container spacing={
                {xs: 0.5, md: 2, lg: 3}
              }>
                <Grid item xs={12} md={3} lg={2.5}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 1.25 }}>
                      <Stack spacing={1}>
                        <Typography fontWeight={800} variant="body2">
                          Điều hướng
                        </Typography>
                        <ToggleButtonGroup
                          exclusive
                          value={String(activeIdx)}
                          onChange={(_, v) => {
                            if (v === null) return;
                            setActiveIdx(Number(v));
                          }}
                          sx={{
                            flexWrap: { xs: "nowrap", md: "wrap" },
                            maxHeight: { xs: 64, md: 320 },
                            overflowX: { xs: "auto", md: "hidden" },
                            overflowY: { xs: "hidden", md: "auto" },
                            alignContent: { xs: "center", md: "flex-start" },
                            "& .MuiToggleButtonGroup-grouped": { mr: 0.5 }
                          }}
                        >
                          {visibleQuestions.map((q, idx) => (
                            <ToggleButton
                              key={q.id}
                              value={String(idx)}
                              size="small"
                              sx={{
                                minWidth: 38,
                                px: 0.5,
                                py: 0.25,
                                ...(isAnswered(q)
                                  ? {
                                      bgcolor: idx === activeIdx ? "success.main" : "success.light",
                                      color: idx === activeIdx ? "success.contrastText" : "success.main",
                                      border: idx === activeIdx ? "1px solid" : "2px solid",
                                      borderColor: "success.main",
                                      "&:hover": {
                                        bgcolor: idx === activeIdx ? "success.dark" : "success.main",
                                        borderColor: "success.dark"
                                      }
                                    }
                                  : null)
                              }}
                              color={isAnswered(q) ? "success" : "primary"}
                            >
                              {idx + 1}
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={activeIdx <= 0}
                            onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                            fullWidth
                          >
                            Trước
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={activeIdx >= visibleQuestions.length - 1}
                            onClick={() => setActiveIdx((i) => Math.min(visibleQuestions.length - 1, i + 1))}
                            fullWidth
                          >
                            Sau
                          </Button>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {activeQ ? (
                            <>
                              Câu {activeNumber}/{visibleQuestions.length} •{" "}
                              {activeQ.part === 1
                                ? "Phần 1"
                                : activeQ.track === null
                                  ? "Phần 2.1"
                                  : `Phần 2.2 - ${trackLabel(activeQ.track)}`}
                            </>
                          ) : null}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={9} lg={9.5}>
                  {activeQ ? (
                    <QuestionView
                      key={activeQ.id}
                      index={activeNumber}
                      q={activeQ}
                      value={answers[String(activeQ.id)]}
                      onChange={(v) => setAnswers((a) => ({ ...a, [String(activeQ.id)]: v }))}
                    />
                  ) : (
                    <Alert severity="info">Không có câu hỏi.</Alert>
                  )}
                </Grid>
              </Grid>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Part 2 is integrated into single-question mode via navigation */}

      {started && (
        <Card>
          <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography fontWeight={800}>Nộp bài</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Điểm sẽ chấm tự động theo đáp án.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  disabled={submitting || !track || score !== null || !attemptId}
                  startIcon={<SendOutlinedIcon />}
                  onClick={async () => {
                    try {
                      setSubmitting(true);
                      setErr(null);
                      const res = await api.submitAttempt(token!, attemptId!, answers);
                      setScore(res.score);
                    } catch (e: any) {
                      setErr(e?.message || "submit_failed");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {score === null ? (submitting ? "Đang nộp..." : "Nộp bài") : "Đã nộp"}
                </Button>
              </Stack>
              {err && <Alert severity={errUi!.severity}>{errUi!.text}</Alert>}
              {score !== null && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={`Điểm: ${score.toFixed(2)}`} color="success" variant="outlined" />
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

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
              {pagedHistory.map((r) => (
                <Card key={r.id} variant="outlined">
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} justifyContent="space-between">
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip size="small" variant="outlined" label={`#${r.id}`} />
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
                            const detail = await api.getAttempt(token!, Number(r.id));
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
              ))}
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
                <Chip size="small" variant="outlined" label={`Attempt #${review.id}`} />
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
                          <Chip size="small" variant="outlined" label={`Type: ${q.qtype}`} />
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
  );
}

function QuestionView({
  q,
  index,
  value,
  onChange
}: {
  q: Q;
  index: number;
  value: any;
  onChange: (v: any) => void;
}) {
  return (
    <Card variant="outlined" sx={{ mr: { xs: 0, md: 3 } }}>
      <CardContent sx={{ p: { xs: 1.5, md: 2 }, pr: { xs: 2.5, md: 2 } }}>
        <Stack spacing={1}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography fontWeight={800}>Câu {index}</Typography>
            <Typography color="text.secondary" variant="body2">
              ({q.points}đ)
            </Typography>
          </Stack>
          <SafeHtml html={q.prompt_html} />
          <Divider />
          {q.qtype === "mcq" ? (
            <Stack spacing={0.75} role="radiogroup" aria-label="Đáp án">
              {q.options.map((opt, i) => {
                const checked = value?.choiceIndex === i;
                return (
                  <Box
                    key={opt.label}
                    onClick={() => onChange({ type: "mcq", choiceIndex: i })}
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1,
                      p: 1,
                      borderRadius: 2,
                      cursor: "pointer",
                      "&:hover": { bgcolor: "action.hover" }
                    }}
                  >
                    <Radio checked={checked} onChange={() => onChange({ type: "mcq", choiceIndex: i })} />
                    <Chip label={opt.label} size="small" variant="outlined" sx={{ mt: 0.5 }} />
                    <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
                      <SafeHtml html={opt.text_html} />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Stack spacing={1}>
              {q.items.map((it) => {
                const current = value?.items?.[it.label];
                return (
                  <Card key={it.label} variant="outlined" sx={{ bgcolor: "background.paper" }}>
                    <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Chip label={it.label} size="small" variant="outlined" />
                          <Box sx={{ flex: 1 }}>
                            <SafeHtml html={it.text_html} />
                          </Box>
                        </Stack>
                        <RadioGroup
                          row
                          value={current === true ? "true" : current === false ? "false" : ""}
                          onChange={(_: React.ChangeEvent<HTMLInputElement>, v: string) =>
                            onChange({
                              type: "tf_multi",
                              items: { ...(value?.items || {}), [it.label]: v === "true" }
                            })
                          }
                        >
                          <FormControlLabel value="true" control={<Radio size="small" />} label="Đúng" />
                          <FormControlLabel value="false" control={<Radio size="small" />} label="Sai" />
                        </RadioGroup>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

