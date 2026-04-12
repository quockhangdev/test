import React, { useEffect, useState } from "react";
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
  Pagination,
  Skeleton,
  Stack,
  Typography
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import StarOutlinedIcon from "@mui/icons-material/StarOutlined";
import Avatar from "boring-avatars";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const AVATAR_SIZE = 44;

function ExamCardThumb({ examId }: { examId: string }) {
  return (
    <Box
      sx={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: 2,
        flex: "0 0 auto",
        overflow: "hidden",
        bgcolor: "action.hover"
      }}
    >
      <Avatar name={`exam-${examId}`} size={AVATAR_SIZE} variant="beam" />
    </Box>
  );
}

export default function Home() {
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
  const pageSize = 8;

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
  }, [exams?.length]);

  if (!user) {
    return (
      <Card>
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

      <Grid container spacing={2}>
        {(exams || []).slice((page - 1) * pageSize, page * pageSize).map((e) => (
          <Grid key={e.id} item xs={12} md={6}>
            <Card
              variant="outlined"
              sx={{
                overflow: "hidden",
                transition: "box-shadow .15s ease, transform .15s ease",
                "&:hover": { boxShadow: 4, transform: "translateY(-1px)" }
              }}
            >
              <CardActionArea component={Link} to={`/exams/${e.id}`} sx={{ display: "block" }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <ExamCardThumb examId={e.id} />

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
                        {(e.tags || []).slice(0, 3).map((t) => (
                          <Chip key={t} size="small" variant="outlined" label={t} />
                        ))}
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
        ))}
        {exams && exams.length === 0 && (
          <Grid item xs={12}>
            <Alert severity="info">Chưa có đề.</Alert>
          </Grid>
        )}
        {!exams && (
          <>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Skeleton variant="text" height={28} />
                  <Skeleton variant="text" />
                  <Skeleton variant="rectangular" height={36} sx={{ mt: 1, borderRadius: 2 }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Skeleton variant="text" height={28} />
                  <Skeleton variant="text" />
                  <Skeleton variant="rectangular" height={36} sx={{ mt: 1, borderRadius: 2 }} />
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>
      {!!exams && exams.length > pageSize && (
        <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
          <Pagination
            page={page}
            count={Math.max(1, Math.ceil(exams.length / pageSize))}
            color="primary"
            shape="rounded"
            onChange={(_, p) => setPage(p)}
          />
        </Stack>
      )}
    </Stack>
  );
}
