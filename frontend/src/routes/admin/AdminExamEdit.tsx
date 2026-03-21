import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  InputAdornment,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import { BarChart, LineChart } from "@mui/x-charts";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { SafeHtml } from "../../components/SafeHtml";

type QuestionRow = any;

const LABELS = ["A", "B", "C", "D", "E", "F"];

type Section = "1" | "2.1" | "2.2";

function trackLabel(t: any): string {
  if (t === "app") return "Tin học ứng dụng";
  if (t === "cs") return "Khoa học máy tính";
  return "—";
}

export default function AdminExamEdit() {
  const { examId } = useParams();
  const { token } = useAuth();

  const [exam, setExam] = useState<any | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openAddQuestion, setOpenAddQuestion] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [openPreview, setOpenPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [examInfoExpanded, setExamInfoExpanded] = useState(false);
  const [openAttempts, setOpenAttempts] = useState(false);
  const [attempts, setAttempts] = useState<any[] | null>(null);
  const [attemptsBusy, setAttemptsBusy] = useState(false);
  const [openAttemptDetail, setOpenAttemptDetail] = useState(false);
  const [attemptDetail, setAttemptDetail] = useState<any | null>(null);
  const [filterTrack, setFilterTrack] = useState<"" | "app" | "cs">("");
  const [filterSubmitted, setFilterSubmitted] = useState<"" | "submitted" | "in_progress">("");
  const [filterQuery, setFilterQuery] = useState("");
  const [filterFrom, setFilterFrom] = useState(""); // yyyy-mm-dd
  const [filterTo, setFilterTo] = useState(""); // yyyy-mm-dd
  const [attemptsPage, setAttemptsPage] = useState(0);
  const [attemptsRpp, setAttemptsRpp] = useState(10);

  // exam form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [accessPassword, setAccessPassword] = useState<string>("");
  const [tagsText, setTagsText] = useState<string>("");

  // question builder
  const [section, setSection] = useState<Section>("1");
  const [track, setTrack] = useState<"app" | "cs">("app");
  const [qtype, setQtype] = useState<"mcq" | "tf_multi">("mcq");
  const [order, setOrder] = useState(0);
  const [points, setPoints] = useState(1);
  const [promptHtml, setPromptHtml] = useState("Nội dung câu hỏi...");
  const [explainHtml, setExplainHtml] = useState<string>("");

  const [mcqOpts, setMcqOpts] = useState(() => LABELS.slice(0, 4).map((l) => ({ label: l, text_html: `Đáp án ${l}` })));
  const [mcqCorrect, setMcqCorrect] = useState(0);

  const [tfItems, setTfItems] = useState(() =>
    LABELS.slice(0, 4).map((l) => ({ label: l, text_html: `Ý ${l}`, is_true: l === "A" }))
  );

  function resetQuestionBuilder() {
    setSection("1");
    setTrack("app");
    setQtype("mcq");
    setOrder(0);
    setPoints(1);
    setPromptHtml("Nội dung câu hỏi...");
    setExplainHtml("");
    setMcqOpts(LABELS.slice(0, 4).map((l) => ({ label: l, text_html: `Đáp án ${l}` })));
    setMcqCorrect(0);
    setTfItems(LABELS.slice(0, 4).map((l) => ({ label: l, text_html: `Ý ${l}`, is_true: l === "A" })));
  }

  function loadQuestionIntoBuilder(q: any) {
    if (q.part === 1) {
      setSection("1");
    } else if (q.part === 2 && !q.track) {
      // part 2.1: chung
      setSection("2.1");
    } else {
      // part 2.2: theo chủ đề
      setSection("2.2");
    }
    setTrack((q.track || "app") as "app" | "cs");
    setQtype(q.qtype);
    setOrder(Number(q.order_in_exam || 0));
    setPoints(Number(q.points || 1));
    setPromptHtml(q.prompt_html || "<p></p>");
    setExplainHtml(q.explanation_html || "");

    if (q.qtype === "mcq") {
      const opts = Array.isArray(q.options) ? q.options : [];
      setMcqOpts(opts.map((o: any) => ({ label: String(o.label), text_html: String(o.text_html || "") })));
      setMcqCorrect(Number.isFinite(q.correct_index) ? Number(q.correct_index) : 0);
    } else {
      const items = Array.isArray(q.items) ? q.items : [];
      setTfItems(
        items.map((it: any) => ({
          label: String(it.label),
          text_html: String(it.text_html || ""),
          is_true: !!it.is_true
        }))
      );
    }
  }

  async function reloadAll() {
    if (!token) return;
    const exams = await api.admin.listExams(token);
    const ex = exams.find((x) => String(x.id) === String(examId));
    setExam(ex || null);
    if (ex) {
      setTitle(ex.title || "");
      setDescription(ex.description || "");
      setPublished(!!ex.is_published);
      setDurationMinutes(Number.isFinite(ex.duration_minutes) ? (ex.duration_minutes as number) : 45);
      setAccessPassword("");
      setTagsText(Array.isArray(ex.tags) ? ex.tags.join(", ") : "");
    }
    const qs = await api.admin.listQuestions(token, Number(examId));
    setQuestions(qs);
  }

  function parseTags(s: string): string[] {
    const parts = s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return Array.from(new Set(parts)).slice(0, 20);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token) return;
        await reloadAll();
      } catch (e: any) {
        if (alive) setErr(e?.message || "error");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, examId]);

  const previewPayload = useMemo(() => {
    const payloadPart: 1 | 2 = section === "1" ? 1 : 2;
    const payloadTrack: "app" | "cs" | null = section === "2.2" ? track : null;
    if (qtype === "mcq") {
      return {
        part: payloadPart,
        track: payloadTrack,
        qtype,
        prompt_html: promptHtml,
        explanation_html: explainHtml || null,
        points,
        order_in_exam: order,
        options: mcqOpts,
        correct_index: mcqCorrect
      };
    }
    return {
      part: payloadPart,
      track: payloadTrack,
      qtype,
      prompt_html: promptHtml,
      explanation_html: explainHtml || null,
      points,
      order_in_exam: order,
      items: tfItems
    };
  }, [qtype, section, track, promptHtml, explainHtml, points, order, mcqOpts, mcqCorrect, tfItems]);

  function getNextOrderForBuilder(nextSection: Section, nextTrack: "app" | "cs") {
    const payloadPart: 1 | 2 = nextSection === "1" ? 1 : 2;
    const payloadTrack: "app" | "cs" | null = nextSection === "2.2" ? nextTrack : null;
    const rows = (questions || []).filter((q) => {
      if (Number(q.part) !== payloadPart) return false;
      // part 1 / 2.1: track phải là null (hoặc không tồn tại)
      if (payloadTrack === null) return !q.track;
      return q.track === payloadTrack;
    });
    let max = -1;
    for (const r of rows) {
      const n = Number(r.order_in_exam);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max + 1;
  }

  // Auto-increase order for newly created questions.
  // The backend enforces uniqueness on (exam_id, part, track, order_in_exam),
  // so we must not reuse the same order within the same section/topic.
  useEffect(() => {
    if (!openAddQuestion) return;
    if (editingQuestionId) return; // editing existing -> keep current order
    // If questions are not loaded yet, keep current value.
    if (!questions) return;

    setOrder(getNextOrderForBuilder(section, track));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddQuestion, editingQuestionId, section, track, questions]);

  const filteredAttempts = useMemo(() => {
    const rows = attempts || [];
    const q = filterQuery.trim().toLowerCase();
    const fromTs = filterFrom ? Date.parse(`${filterFrom}T00:00:00`) : null;
    const toTs = filterTo ? Date.parse(`${filterTo}T23:59:59`) : null;

    return rows.filter((a) => {
      if (filterTrack && a.track_chosen !== filterTrack) return false;
      const submitted = !!a.submitted_at;
      if (filterSubmitted === "submitted" && !submitted) return false;
      if (filterSubmitted === "in_progress" && submitted) return false;

      if (q) {
        const hay = `${a.user?.full_name || ""} ${a.user?.email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      const startedTs = a.started_at ? Date.parse(a.started_at) : null;
      if (fromTs && startedTs && startedTs < fromTs) return false;
      if (toTs && startedTs && startedTs > toTs) return false;
      return true;
    });
  }, [attempts, filterTrack, filterSubmitted, filterQuery, filterFrom, filterTo]);

  useEffect(() => {
    setAttemptsPage(0);
  }, [filterTrack, filterSubmitted, filterQuery, filterFrom, filterTo, openAttempts]);

  const pagedAttempts = useMemo(() => {
    const start = attemptsPage * attemptsRpp;
    return filteredAttempts.slice(start, start + attemptsRpp);
  }, [filteredAttempts, attemptsPage, attemptsRpp]);

  const chartData = useMemo(() => {
    const rows = filteredAttempts.filter((a) => a.score !== null && a.score !== undefined);
    const scores = rows.map((a) => Number(a.score)).filter((x) => Number.isFinite(x));

    const bins = [0, 2, 4, 6, 8, 10];
    const labels = ["0–2", "2–4", "4–6", "6–8", "8–10"];
    const counts = new Array(labels.length).fill(0);
    for (const s of scores) {
      const idx =
        s < 2 ? 0 :
        s < 4 ? 1 :
        s < 6 ? 2 :
        s < 8 ? 3 : 4;
      counts[idx] += 1;
    }

    // attempts per day
    const byDay = new Map<string, number>();
    for (const a of filteredAttempts) {
      const d = a.started_at ? new Date(a.started_at) : null;
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      byDay.set(key, (byDay.get(key) || 0) + 1);
    }
    const days = Array.from(byDay.entries()).sort((x, y) => x[0].localeCompare(y[0]));

    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    return {
      scoreLabels: labels,
      scoreCounts: counts,
      dayLabels: days.map((d) => d[0]),
      dayCounts: days.map((d) => d[1]),
      avgScore: avg,
      total: filteredAttempts.length,
      submittedCount: filteredAttempts.filter((a) => !!a.submitted_at).length
    };
  }, [filteredAttempts]);

  if (!exam) {
    return (
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Alert severity="error">Không tìm thấy đề.</Alert>
            <Button component={Link} to="/admin/exams" variant="outlined" startIcon={<ArrowBackOutlinedIcon />}>
              Quay lại
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography fontWeight={900}>Đề #{exam.id}</Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddOutlinedIcon />}
                  onClick={() => {
                    setEditingQuestionId(null);
                    resetQuestionBuilder();
                    setOpenAddQuestion(true);
                  }}
                >
                  Thêm câu hỏi
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<HistoryOutlinedIcon />}
                  onClick={async () => {
                    try {
                      setOpenAttempts(true);
                      setAttemptsBusy(true);
                      setFilterTrack("");
                      setFilterSubmitted("");
                      setFilterQuery("");
                      setFilterFrom("");
                      setFilterTo("");
                      const rows = await api.admin.listAttempts(token!, { exam_id: Number(examId) });
                      setAttempts(rows);
                    } catch (e: any) {
                      setErr(e?.message || "attempts_failed");
                    } finally {
                      setAttemptsBusy(false);
                    }
                  }}
                >
                  Lịch sử
                </Button>
                <Button component={Link} to="/admin/exams" variant="outlined" size="small" startIcon={<ArrowBackOutlinedIcon />}>
                  Quay lại
                </Button>
              </Stack>
            </Stack>
            <Divider />
            <Accordion
              expanded={examInfoExpanded}
              onChange={(_, v) => setExamInfoExpanded(v)}
              elevation={0}
              disableGutters
              sx={{ border: 1, borderColor: "divider", borderRadius: 2, "&:before": { display: "none" } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ minWidth: 0, flexWrap: "wrap", rowGap: 0.5 }}
                >
                  <Typography fontWeight={800} noWrap>
                    Thông tin đề
                  </Typography>
                  <Chip
                    size="small"
                    label={published ? "Published" : "Draft"}
                    color={published ? "success" : "default"}
                    variant="outlined"
                  />
                  {exam?.duration_minutes ? (
                    <Chip size="small" label={`${exam.duration_minutes} phút`} variant="outlined" />
                  ) : (
                    <Chip size="small" label="Không giới hạn" variant="outlined" />
                  )}
                  {exam?.requires_password ? (
                    <Chip size="small" label="Có password" color="warning" variant="outlined" />
                  ) : null}
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
                    {title || "(chưa có tiêu đề)"}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1.5} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small"
                      label="Tiêu đề"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControlLabel
                      control={<Checkbox checked={published} onChange={(e) => setPublished(e.target.checked)} />}
                      label="Published"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      size="small"
                      label="Thời gian làm bài (phút)"
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      inputProps={{ min: 1, max: 600, step: 1 }}
                      fullWidth
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      size="small"
                      label="Mô tả"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      fullWidth
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small"
                      label="Tags (phân tách bằng dấu phẩy)"
                      value={tagsText}
                      onChange={(e) => setTagsText(e.target.value)}
                      placeholder="SQL, C++, HTML"
                      fullWidth
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small"
                      label="Password đề"
                      type="password"
                      value={accessPassword}
                      onChange={(e) => setAccessPassword(e.target.value)}
                      fullWidth
                      placeholder={exam?.requires_password ? "••••••" : ""}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip
                              title={
                                <div>
                                  <div><b>Để trống</b>: giữ nguyên password hiện tại</div>
                                  <div><b>Nhập mới</b>: đổi password</div>
                                  <div><b>Nhập rỗng</b>: xoá password (nhập 1 ký tự rồi xoá về rỗng, sau đó bấm Lưu)</div>
                                </div>
                              }
                            >
                              <IconButton size="small" edge="end" tabIndex={-1}>
                                <HelpOutlineOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<SaveOutlinedIcon />}
                        onClick={async () => {
                          try {
                            setErr(null);
                            await api.admin.updateExam(token!, Number(examId), {
                              title: title.trim(),
                              description: description.trim() || null,
                              is_published: published,
                              duration_minutes: Number.isFinite(durationMinutes) ? durationMinutes : null,
                              access_password: accessPassword === "" ? null : accessPassword,
                              tags: parseTags(tagsText)
                            });
                            await reloadAll();
                            setExamInfoExpanded(false);
                            setAccessPassword("");
                          } catch (e: any) {
                            setErr(e?.message || "update_failed");
                          }
                        }}
                      >
                        Lưu
                      </Button>
                    </Stack>
                  </Grid>
                  {err && (
                    <Grid item xs={12}>
                      <Alert severity="error">{err}</Alert>
                    </Grid>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography fontWeight={800}>Câu hỏi</Typography>
              <Button variant="contained" size="small" startIcon={<AddOutlinedIcon />} onClick={() => setOpenAddQuestion(true)}>
                Thêm câu hỏi
              </Button>
            </Stack>
            {!questions ? (
              <Typography color="text.secondary">Đang tải...</Typography>
            ) : questions.length === 0 ? (
              <Alert severity="info">Chưa có câu hỏi.</Alert>
            ) : (
              <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 70 }}>ID</TableCell>
                      <TableCell sx={{ width: 90 }}>Part</TableCell>
                      <TableCell sx={{ width: 90 }}>Track</TableCell>
                      <TableCell sx={{ width: 110 }}>Type</TableCell>
                      <TableCell sx={{ width: 90 }}>Order</TableCell>
                      <TableCell sx={{ width: 80 }}>Pts</TableCell>
                      <TableCell>Prompt</TableCell>
                      <TableCell align="right" sx={{ width: 120 }}>
                        Thao tác
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={q.id} hover>
                        <TableCell>{q.id}</TableCell>
                        <TableCell>
                          <Chip
                            label={q.part === 1 ? "1" : q.track ? "2.2" : "2.1"}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {q.part === 2 && q.track ? <Chip label={q.track} size="small" variant="outlined" /> : "—"}
                        </TableCell>
                        <TableCell>
                          <Chip label={q.qtype} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{q.order_in_exam}</TableCell>
                        <TableCell>{q.points}</TableCell>
                        <TableCell sx={{ maxWidth: 520 }}>
                          <Typography variant="body2" color="text.secondary" noWrap title={q.prompt_html || ""}>
                            {q.prompt_html ? q.prompt_html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "—"}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Xem">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setPreviewHtml(q.prompt_html || "");
                                  setOpenPreview(true);
                                }}
                              >
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Sửa">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingQuestionId(Number(q.id));
                                  loadQuestionIntoBuilder(q);
                                  setOpenAddQuestion(true);
                                }}
                              >
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Xoá">
                              <IconButton
                                color="error"
                                size="small"
                                onClick={async () => {
                                  if (!confirm("Xoá câu hỏi này?")) return;
                                  try {
                                    await api.admin.deleteQuestion(token!, q.id);
                                    await reloadAll();
                                  } catch (e: any) {
                                    setErr(e?.message || "delete_question_failed");
                                  }
                                }}
                              >
                                <DeleteOutlineOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={openPreview}
        onClose={() => setOpenPreview(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography fontWeight={800}>Xem câu hỏi</Typography>
            <IconButton onClick={() => setOpenPreview(false)}>
              <CloseOutlinedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <SafeHtml html={previewHtml || "<p>(trống)</p>"} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={openAddQuestion}
        onClose={() => setOpenAddQuestion(false)}
        fullScreen
        scroll="paper"
      >
        <DialogTitle sx={{ py: 0.75, px: { xs: 1, sm: 2 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800} noWrap>
              {editingQuestionId ? `Sửa câu hỏi #${editingQuestionId}` : "Thêm câu hỏi"}
            </Typography>
            <IconButton size="small" onClick={() => setOpenAddQuestion(false)}>
              <CloseOutlinedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ flex: 1, overflowY: "auto" }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="part-label">Phần</InputLabel>
                    <Select
                      labelId="part-label"
                      label="Phần"
                      value={section}
                      onChange={(e) => setSection(e.target.value as Section)}
                    >
                      <MenuItem value={"1"}>Phần 1</MenuItem>
                      <MenuItem value={"2.1"}>Phần 2.1 - Câu hỏi chung</MenuItem>
                      <MenuItem value={"2.2"}>Phần 2.2 - Câu hỏi theo chủ đề</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small" disabled={section !== "2.2"}>
                    <InputLabel id="track-label">Định hướng</InputLabel>
                    <Select labelId="track-label" label="Định hướng" value={track} onChange={(e) => setTrack(e.target.value as any)}>
                      <MenuItem value="app">Tin học ứng dụng</MenuItem>
                      <MenuItem value="cs">Khoa học máy tính</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="qtype-label">Loại</InputLabel>
                    <Select labelId="qtype-label" label="Loại" value={qtype} onChange={(e) => setQtype(e.target.value as any)}>
                      <MenuItem value="mcq">Trắc nghiệm</MenuItem>
                      <MenuItem value="tf_multi">Đúng/Sai</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField fullWidth size="small" label="Thứ tự" type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
                  <TextField fullWidth size="small" label="Điểm" type="number" inputProps={{ step: 0.25 }} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
                </Stack>

                <Box data-color-mode="light">
                  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                    Nội dung câu hỏi (Markdown/HTML)
                  </Typography>
                  <MDEditor value={promptHtml} onChange={(v) => setPromptHtml(v || "")} preview="edit" height={220} />
                  <Typography variant="caption" color="text.secondary">
                    Hỗ trợ Markdown; nếu cần code block dùng ```cpp / ```sql / ```python.
                  </Typography>
                </Box>

                {qtype === "mcq" ? (
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography fontWeight={700}>Đáp án</Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddOutlinedIcon />}
                        onClick={() =>
                          setMcqOpts((arr) => [...arr, { label: LABELS[arr.length] || `X${arr.length + 1}`, text_html: "<p>...</p>" }])
                        }
                      >
                        Thêm lựa chọn
                      </Button>
                    </Stack>
                    <RadioGroup value={mcqCorrect} onChange={(_, v) => setMcqCorrect(Number(v))}>
                      {mcqOpts.map((o, i) => (
                        <Card key={o.label} variant="outlined">
                          <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip label={o.label} size="small" variant="outlined" />
                                <FormControlLabel value={i} control={<Radio size="small" />} label="Đáp án đúng" />
                              </Stack>
                              <Box data-color-mode="light">
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                                  Nội dung {o.label} (Markdown/HTML)
                                </Typography>
                                <MDEditor
                                  value={o.text_html}
                                  onChange={(v) =>
                                    setMcqOpts((arr) => arr.map((x, idx) => (idx === i ? { ...x, text_html: v || "" } : x)))
                                  }
                                  preview="edit"
                                  height={120}
                                />
                              </Box>
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                    </RadioGroup>
                  </Stack>
                ) : (
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography fontWeight={700}>Các ý (A/B/C/...)</Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddOutlinedIcon />}
                        onClick={() =>
                          setTfItems((arr) => [...arr, { label: LABELS[arr.length] || `X${arr.length + 1}`, text_html: "<p>...</p>", is_true: false }])
                        }
                      >
                        Thêm ý
                      </Button>
                    </Stack>
                    <Stack spacing={1}>
                      {tfItems.map((it, i) => (
                        <Card key={it.label} variant="outlined">
                          <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                <Chip label={it.label} size="small" variant="outlined" />
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={!!it.is_true}
                                      onChange={(e) =>
                                        setTfItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, is_true: e.target.checked } : x)))
                                      }
                                    />
                                  }
                                  label="Ý đúng"
                                />
                              </Stack>
                              <Box data-color-mode="light">
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                                  Nội dung {it.label} (Markdown/HTML)
                                </Typography>
                                <MDEditor
                                  value={it.text_html}
                                  onChange={(v) =>
                                    setTfItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, text_html: v || "" } : x)))
                                  }
                                  preview="edit"
                                  height={120}
                                />
                              </Box>
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  </Stack>
                )}

                <Box data-color-mode="light">
                  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                    Giải thích (Markdown/HTML)
                  </Typography>
                  <MDEditor value={explainHtml} onChange={(v) => setExplainHtml(v || "")} preview="edit" height={150} />
                </Box>
              </Stack>
            </Grid>

            <Grid item xs={12} md={5}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography fontWeight={800}>Preview</Typography>
                    <Divider />
                    <SafeHtml html={promptHtml} />
                    <Divider />
                    {qtype === "mcq" ? (
                      <Stack spacing={1}>
                        {mcqOpts.map((o, i) => (
                          <Card key={o.label} variant="outlined">
                            <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                              <Stack spacing={1}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Chip label={o.label} size="small" variant="outlined" />
                                  {mcqCorrect === i && <Chip label="Đúng" size="small" color="success" variant="outlined" />}
                                </Stack>
                                <SafeHtml html={o.text_html} />
                              </Stack>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    ) : (
                      <Stack spacing={1}>
                        {tfItems.map((it) => (
                          <Card key={it.label} variant="outlined">
                            <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                              <Stack spacing={1}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Chip label={it.label} size="small" variant="outlined" />
                                  <Chip label={it.is_true ? "Đúng" : "Sai"} size="small" variant="outlined" />
                                </Stack>
                                <SafeHtml html={it.text_html} />
                              </Stack>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<CloseOutlinedIcon />}
            onClick={() => {
              setOpenAddQuestion(false);
              setEditingQuestionId(null);
              resetQuestionBuilder();
            }}
          >
            Đóng
          </Button>
          <Button
            variant="contained"
            startIcon={editingQuestionId ? <SaveOutlinedIcon /> : <AddOutlinedIcon />}
            onClick={async () => {
              try {
                setErr(null);
                if (editingQuestionId) {
                  await api.admin.updateQuestion(token!, editingQuestionId, previewPayload);
                } else {
                  await api.admin.createQuestion(token!, Number(examId), previewPayload);
                }
                await reloadAll();
                setOpenAddQuestion(false);
                setEditingQuestionId(null);
                resetQuestionBuilder();
              } catch (e: any) {
                setErr(e?.message || "create_question_failed");
              }
            }}
          >
            {editingQuestionId ? "Lưu" : "Tạo câu hỏi"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openAttempts} onClose={() => setOpenAttempts(false)} fullWidth maxWidth="lg">
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography fontWeight={800}>Lịch sử làm bài</Typography>
            <IconButton onClick={() => setOpenAttempts(false)}>
              <CloseOutlinedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {attemptsBusy && <Typography color="text.secondary">Đang tải...</Typography>}
          {!attemptsBusy && (!attempts || attempts.length === 0) && <Alert severity="info">Chưa có lượt làm bài.</Alert>}
          {!attemptsBusy && attempts && attempts.length > 0 && (
            <Stack spacing={2}>
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} md={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="flt-track">Track</InputLabel>
                    <Select labelId="flt-track" label="Track" value={filterTrack} onChange={(e) => setFilterTrack(e.target.value as any)}>
                      <MenuItem value="">Tất cả</MenuItem>
                      <MenuItem value="app">app</MenuItem>
                      <MenuItem value="cs">cs</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="flt-sub">Trạng thái</InputLabel>
                    <Select labelId="flt-sub" label="Trạng thái" value={filterSubmitted} onChange={(e) => setFilterSubmitted(e.target.value as any)}>
                      <MenuItem value="">Tất cả</MenuItem>
                      <MenuItem value="submitted">Đã nộp</MenuItem>
                      <MenuItem value="in_progress">Chưa nộp</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField size="small" label="Tìm (email / tên)" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} fullWidth />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField size="small" label="Từ ngày" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField size="small" label="Đến ngày" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={`Kết quả: ${chartData.total}`} />
                <Chip size="small" variant="outlined" label={`Đã nộp: ${chartData.submittedCount}`} />
                {chartData.avgScore !== null && (
                  <Chip size="small" color="success" variant="outlined" label={`TB điểm: ${chartData.avgScore.toFixed(2)}`} />
                )}
              </Stack>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography fontWeight={800} variant="body2" sx={{ mb: 1 }}>
                        Phân bố điểm
                      </Typography>
                      <BarChart
                        height={220}
                        xAxis={[{ data: chartData.scoreLabels, scaleType: "band" }]}
                        series={[{ data: chartData.scoreCounts, label: "Lượt" }]}
                        grid={{ horizontal: true }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography fontWeight={800} variant="body2" sx={{ mb: 1 }}>
                        Lượt làm theo ngày
                      </Typography>
                      <LineChart
                        height={220}
                        xAxis={[{ data: chartData.dayLabels, scaleType: "point" }]}
                        series={[{ data: chartData.dayCounts, label: "Lượt" }]}
                        grid={{ horizontal: true }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 80 }}>ID</TableCell>
                      <TableCell>Học sinh</TableCell>
                      <TableCell sx={{ width: 110 }}>Track</TableCell>
                      <TableCell sx={{ width: 140 }}>Nộp</TableCell>
                      <TableCell sx={{ width: 110 }}>Điểm</TableCell>
                      <TableCell align="right" sx={{ width: 120 }}>Xem</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedAttempts.map((a) => (
                      <TableRow key={a.id} hover>
                        <TableCell>#{a.id}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>
                            {a.user?.full_name || a.user?.email || "—"}
                          </Typography>
                          {a.user?.email && (
                            <Typography variant="body2" color="text.secondary">
                              {a.user.email}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{trackLabel(a.track_chosen)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {a.submitted_at ? "Đã nộp" : "Chưa nộp"}
                          </Typography>
                        </TableCell>
                        <TableCell>{a.score !== null && a.score !== undefined ? Number(a.score).toFixed(2) : "—"}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!a.submitted_at}
                            onClick={async () => {
                              try {
                                const d = await api.admin.getAttempt(token!, Number(a.id));
                                setAttemptDetail(d);
                                setOpenAttemptDetail(true);
                              } catch (e: any) {
                                setErr(e?.message || "attempt_detail_failed");
                              }
                            }}
                          >
                            Chi tiết
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAttempts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Typography color="text.secondary">Không có dữ liệu theo filter.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={filteredAttempts.length}
                page={attemptsPage}
                onPageChange={(_, p) => setAttemptsPage(p)}
                rowsPerPage={attemptsRpp}
                onRowsPerPageChange={(e) => {
                  setAttemptsRpp(parseInt(e.target.value, 10));
                  setAttemptsPage(0);
                }}
                rowsPerPageOptions={[5, 10, 20, 50]}
                labelRowsPerPage="Dòng/trang"
              />
            </Stack>          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openAttemptDetail} onClose={() => setOpenAttemptDetail(false)} fullWidth maxWidth="lg">
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography fontWeight={800}>Chi tiết lượt làm</Typography>
            <IconButton onClick={() => setOpenAttemptDetail(false)}>
              <CloseOutlinedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {!attemptDetail ? (
            <Typography color="text.secondary">Đang tải...</Typography>
          ) : (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={`Attempt #${attemptDetail.id}`} />
                {attemptDetail.user?.email && <Chip size="small" variant="outlined" label={attemptDetail.user.email} />}
                {attemptDetail.score !== null && <Chip size="small" color="success" variant="outlined" label={`Điểm: ${Number(attemptDetail.score).toFixed(2)}`} />}
              </Stack>
              <Divider />
              <Stack spacing={1.5}>
                {(attemptDetail.questions || []).map((q: any, idx: number) => (
                  <Card key={q.id} variant="outlined">
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                          <Chip size="small" variant="outlined" label={`Câu ${idx + 1}`} />
                          <Chip size="small" variant="outlined" label={`${q.earned_points?.toFixed?.(2) ?? q.earned_points}/${q.points}`} color="success" />
                          <Chip size="small" variant="outlined" label={`Type: ${q.qtype}`} />
                        </Stack>
                        <SafeHtml html={q.prompt_html} />
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

