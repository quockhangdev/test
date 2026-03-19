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
  Skeleton,
  Stack,
  Typography
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Home() {
  const { user, token } = useAuth();
  const [exams, setExams] = useState<
    Array<{
      id: number;
      title: string;
      description: string | null;
      duration_minutes: number | null;
      requires_password: boolean;
    }> | null
  >(null);
  const [err, setErr] = useState<string | null>(null);

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
    <Stack spacing={2}>
      {err && <Alert severity="error">{err}</Alert>}

      <Grid container spacing={2}>
        {(exams || []).map((e) => (
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
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        display: "grid",
                        placeItems: "center",
                        flex: "0 0 auto",
                        fontWeight: 900
                      }}
                    >
                      {String(e.id).slice(-2)}
                    </Box>

                    <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <Typography fontWeight={900} noWrap title={e.title} sx={{ flex: 1 }}>
                          {e.title}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          variant="outlined"
                          icon={<TimerOutlinedIcon />}
                          label={e.duration_minutes ? `${e.duration_minutes} phút` : "Không giới hạn"}
                        />
                        {e.requires_password && (
                          <Chip size="small" color="warning" variant="outlined" icon={<LockOutlinedIcon />} label="Có mật khẩu" />
                        )}
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
                        <Button variant="contained" size="small" endIcon={<PlayArrowRoundedIcon />}>
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
            <Alert severity="info">Chưa có đề nào được publish.</Alert>
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
    </Stack>
  );
}

