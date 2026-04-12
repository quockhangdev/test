import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  IconButton,
  InputAdornment,
  Pagination,
  Skeleton,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import StarOutlinedIcon from "@mui/icons-material/StarOutlined";
import Avatar from "boring-avatars";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const AVATAR_SIZE = 44;
const THUMB_BOX = 52;

const EXAM_CARD_PALETTE = [
  { main: "#1565c0" },
  { main: "#6a1b9a" },
  { main: "#00695c" },
  { main: "#e65100" },
  { main: "#4527a0" },
  { main: "#2e7d32" }
];

function examCardThemeFromId(examId: string): { main: string } {
  let h = 0;
  for (let i = 0; i < examId.length; i++) h = (Math.imul(31, h) + examId.charCodeAt(i)) | 0;
  return EXAM_CARD_PALETTE[Math.abs(h) % EXAM_CARD_PALETTE.length];
}

/** Màu ổn định theo chữ tag — mỗi tag khác nhau có thể khác màu. */
const TAG_PALETTE = [
  "#1565c0",
  "#6a1b9a",
  "#00695c",
  "#e65100",
  "#4527a0",
  "#2e7d32",
  "#ad1457",
  "#00838f",
  "#558b2f",
  "#283593",
  "#6d4c41",
  "#c62828"
];

function tagColorFromLabel(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (Math.imul(31, h) + label.charCodeAt(i)) | 0;
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}

/** Mỗi từ (cách bởi khoảng trắng) phải xuất hiện trong tiêu đề, mô tả hoặc ít nhất một tag. */
function examMatchesSearchQuery(
  e: {
    title: string;
    description: string | null;
    tags: string[];
  },
  rawQuery: string
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const hay = [e.title, e.description || "", ...(e.tags || [])].join("\n").toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  return words.every((w) => hay.includes(w));
}

function ExamCardThumb({ examId, main }: { examId: string; main: string }) {
  const iconBg = alpha(main, 0.12);
  const borderSoft = alpha(main, 0.22);
  return (
    <Box
      sx={{
        width: THUMB_BOX,
        height: THUMB_BOX,
        borderRadius: "50%",
        flex: "0 0 auto",
        overflow: "hidden",
        bgcolor: iconBg,
        border: `1px solid ${borderSoft}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Avatar name={`exam-${examId}`} size={AVATAR_SIZE} variant="beam" />
    </Box>
  );
}

export default function Home() {
  const muiTheme = useTheme();
  const { user, token } = useAuth();
  const [exams, setExams] = useState<
    Array<{
      id: string;
      title: string;
      description: string | null;
      duration_minutes: number | null;
      requires_password: boolean;
      tags: string[];
      is_favorite: boolean;
    }> | null
  >(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const pageSize = 8;

  const allTagsSorted = useMemo(() => {
    if (!exams) return [];
    const s = new Set<string>();
    for (const e of exams) {
      for (const t of e.tags || []) {
        if (t) s.add(t);
      }
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "vi"));
  }, [exams]);

  const filteredExams = useMemo(() => {
    if (!exams) return [];
    let list = exams;
    if (selectedTags.length > 0) {
      list = list.filter((e) => {
        const have = new Set(e.tags || []);
        return selectedTags.every((t) => have.has(t));
      });
    }
    if (searchQuery.trim()) {
      list = list.filter((e) => examMatchesSearchQuery(e, searchQuery));
    }
    return list;
  }, [exams, selectedTags, searchQuery]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token) return;
        const list = await api.listExams(token);
        if (alive) setExams(list);
      } catch (e: any) {
        if (alive) setErr(e?.message || "error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    setPage(1);
  }, [exams?.length, selectedTags.join("\0"), searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredExams.length / pageSize) || 1);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!user) {
    return (
      <Card sx={{ borderRadius: 1 }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography color="text.secondary">
              Đăng nhập để xem danh sách đề và bắt đầu làm bài trắc nghiệm.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack>
      {err && <Alert severity="error">{err}</Alert>}

      {!!exams && exams.length > 0 && (
        <Box
          sx={{
            mb: 2,
            p: { xs: 1, sm: 1.25 },
            borderRadius: 1,
            border: 1,
            borderColor: "divider",
            bgcolor: alpha(muiTheme.palette.text.primary, muiTheme.palette.mode === "dark" ? 0.04 : 0.03)
          }}
        >
          <Stack spacing={0.75}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap sx={{ gap: 0.75 }}>
              <TextField
                size="small"
                placeholder="Tìm đề, mô tả, tag…"
                value={searchQuery}
                onChange={(ev) => setSearchQuery(ev.target.value)}
                InputProps={{
                  "aria-label": "Tìm kiếm đề thi",
                  sx: { fontSize: "0.8125rem" },
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 1 }}>
                      <SearchRoundedIcon color="action" sx={{ fontSize: 18 }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton size="small" aria-label="Xóa từ khóa" onClick={() => setSearchQuery("")} edge="end" sx={{ p: 0.25 }}>
                        <ClearRoundedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null
                }}
                sx={{ flex: "1 1 200px", minWidth: 0 }}
              />
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0, ml: "auto" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                  {filteredExams.length === exams.length
                    ? `${exams.length} đề`
                    : `${filteredExams.length}/${exams.length}`}
                </Typography>
                {(selectedTags.length > 0 || searchQuery.trim()) && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => {
                      setSelectedTags([]);
                      setSearchQuery("");
                    }}
                    sx={{ textTransform: "none", minWidth: 0, px: 0.5, py: 0, fontSize: "0.75rem", lineHeight: 1.2 }}
                  >
                    Xóa lọc
                  </Button>
                )}
              </Stack>
            </Stack>

            {allTagsSorted.length > 0 && (
              <Stack direction="row" flexWrap="wrap" useFlexGap alignItems="center" sx={{ columnGap: 0.5, rowGap: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mr: 0.25, lineHeight: 1.8 }}>
                  Chủ đề
                </Typography>
                {allTagsSorted.map((t) => {
                  const tc = tagColorFromLabel(t);
                  const on = selectedTags.includes(t);
                  return (
                    <Chip
                      key={t}
                      label={t}
                      size="small"
                      onClick={() =>
                        setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
                      }
                      sx={{
                        height: 22,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "0.7rem",
                        borderColor: alpha(tc, on ? 0.55 : 0.42),
                        bgcolor: on ? alpha(tc, 0.22) : alpha(tc, 0.09),
                        color: tc,
                        "& .MuiChip-label": { px: 0.65 },
                        "&:hover": {
                          bgcolor: on ? alpha(tc, 0.28) : alpha(tc, 0.14)
                        }
                      }}
                      variant="outlined"
                    />
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Box>
      )}

      <Grid container spacing={2}>
        {filteredExams.slice((page - 1) * pageSize, page * pageSize).map((e) => {
          const { main } = examCardThemeFromId(e.id);
          const borderSoft = alpha(main, 0.22);
          return (
          <Grid key={e.id} item xs={12} md={6}>
            <Card
              variant="outlined"
              sx={{
                overflow: "hidden",
                borderRadius: 1,
                borderColor: alpha(main, 0.18),
                bgcolor: muiTheme.palette.background.paper,
                transition: muiTheme.transitions.create(["border-color", "background-color"], {
                  duration: muiTheme.transitions.duration.shorter
                }),
                "&:hover": {
                  borderColor: borderSoft,
                  bgcolor: alpha(main, 0.03)
                }
              }}
            >
              <CardActionArea
                component={Link}
                to={`/exams/${e.id}`}
                sx={{
                  display: "block",
                  "&:hover .MuiCardActionArea-focusHighlight": { opacity: 0 }
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <ExamCardThumb examId={e.id} main={main} />

                    <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <Typography fontWeight={900} noWrap title={e.title} sx={{ flex: 1 }}>
                          {e.title}
                        </Typography>
                        <IconButton
                          size="small"
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                          }}
                          onTouchStart={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                          }}
                          onClick={async (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            try {
                              if (!token) return;
                              const next = !e.is_favorite;
                              if (next) await api.favoriteExam(token, e.id);
                              else await api.unfavoriteExam(token, e.id);
                              setExams((prev) =>
                                prev ? prev.map((x) => (x.id === e.id ? { ...x, is_favorite: next } : x)) : prev
                              );
                            } catch (ex: any) {
                              setErr(ex?.message || "favorite_failed");
                            }
                          }}
                          aria-label={e.is_favorite ? "Bỏ yêu thích" : "Yêu thích"}
                        >
                          {e.is_favorite ? <StarOutlinedIcon color="warning" /> : <StarBorderOutlinedIcon />}
                        </IconButton>
                      </Stack>

                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ rowGap: 0.75, columnGap: 0.75 }}
                      >
                        <Chip
                          size="small"
                          variant="outlined"
                          icon={<TimerOutlinedIcon />}
                          label={e.duration_minutes ? `${e.duration_minutes} phút` : "Không giới hạn"}
                        />
                        {e.requires_password && (
                          <Chip size="small" color="warning" variant="outlined" icon={<LockOutlinedIcon />} label="Có mật khẩu" />
                        )}
                        {(e.tags || []).slice(0, 3).map((t) => {
                          const tc = tagColorFromLabel(t);
                          return (
                            <Chip
                              key={t}
                              size="small"
                              variant="outlined"
                              label={t}
                              sx={{
                                borderColor: alpha(tc, 0.42),
                                bgcolor: alpha(tc, 0.09),
                                color: tc,
                                fontWeight: 600,
                                "& .MuiChip-label": { px: 0.85 }
                              }}
                            />
                          );
                        })}
                        {(e.tags || []).length > 3 && <Chip size="small" variant="outlined" label={`+${(e.tags || []).length - 3}`} />}
                      </Stack>

                      {e.description ? (
                        <Typography color="text.secondary" variant="body2" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {e.description}
                        </Typography>
                      ) : (
                        <Typography color="text.secondary" variant="body2">
                          &nbsp;
                        </Typography>
                      )}

                      <Stack direction="row" justifyContent="flex-end">
                        <Button variant="contained" size="small" fullWidth={false} sx={{ width: { xs: "100%", sm: "auto" } }} endIcon={<PlayArrowRoundedIcon />}>
                          Vào làm bài
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
          );
        })}
        {exams && exams.length === 0 && (
          <Grid item xs={12}>
            <Alert severity="info">Chưa có đề.</Alert>
          </Grid>
        )}
        {exams && exams.length > 0 && filteredExams.length === 0 && (
          <Grid item xs={12}>
            <Alert severity="info">
              Không có đề nào khớp từ khóa hoặc bộ lọc chủ đề. Thử bỏ bớt điều kiện hoặc từ khóa khác.
            </Alert>
          </Grid>
        )}
        {!exams && (
          <>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent>
                  <Skeleton variant="text" height={28} />
                  <Skeleton variant="text" />
                  <Skeleton variant="rectangular" height={36} sx={{ mt: 1, borderRadius: 1 }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent>
                  <Skeleton variant="text" height={28} />
                  <Skeleton variant="text" />
                  <Skeleton variant="rectangular" height={36} sx={{ mt: 1, borderRadius: 1 }} />
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>
      {!!exams && filteredExams.length > 0 && totalPages > 1 && (
        <Stack direction="row" justifyContent="center" alignItems="center" flexWrap="wrap" useFlexGap sx={{ gap: 1, mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ width: "100%", textAlign: "center" }}>
            Trang {page} / {totalPages}
          </Typography>
          <Pagination
            page={page}
            count={totalPages}
            color="primary"
            shape="rounded"
            showFirstButton
            showLastButton
            onChange={(_, p) => setPage(p)}
          />
        </Stack>
      )}
    </Stack>
  );
}
