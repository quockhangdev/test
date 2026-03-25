import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Box, Card, CardActionArea, CardContent, Chip, Pagination, Stack, Typography } from "@mui/material";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const PICSUM_W = 600;
const PICSUM_H = 800;

const thumbColumnSx = {
  position: "relative" as const,
  flex: "0 0 auto",
  width: { xs: 120, sm: 160, md: 200 },
  minHeight: { xs: 132, sm: 152 },
  alignSelf: "stretch",
  bgcolor: "action.hover"
};

function PostCardThumb({ postId }: { postId: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <Box sx={thumbColumnSx}>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            fontWeight: 900,
            fontSize: "1.25rem"
          }}
        >
          {String(postId).slice(-2)}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={thumbColumnSx}>
      <Box
        component="img"
        src={`https://picsum.photos/seed/${postId}/${PICSUM_W}/${PICSUM_H}`}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block"
        }}
      />
    </Box>
  );
}

export default function Posts() {
  const { token } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token) return;
        const list = await api.listPosts(token);
        if (alive) setRows(list);
      } catch (e: any) {
        if (alive) setErr(e?.message || "load_posts_failed");
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    setPage(1);
  }, [rows?.length]);

  return (
    <Stack spacing={2}>
      <Typography variant="h6" fontWeight={800}>
        Bài viết
      </Typography>
      {err && <Alert severity="error">{err}</Alert>}
      {!rows ? (
        <Typography color="text.secondary">Đang tải...</Typography>
      ) : rows.length === 0 ? (
        <Alert severity="info">Chưa có bài viết nào.</Alert>
      ) : (
        <>
          {rows.slice((page - 1) * pageSize, page * pageSize).map((p) => (
            <Card
              key={p.id}
              variant="outlined"
              sx={{
                overflow: "hidden",
                transition: "box-shadow .15s ease, transform .15s ease",
                "&:hover": { boxShadow: 4, transform: "translateY(-1px)" }
              }}
            >
              <CardActionArea
                component={Link}
                to={`/posts/${p.slug}`}
                sx={{ display: "flex", alignItems: "stretch", p: 0, textAlign: "left" }}
              >
                <PostCardThumb postId={p.id} />
                <CardContent sx={{ flex: 1, py: { xs: 1.5, sm: 2 }, pl: { xs: 1.5, sm: 2 }, pr: { xs: 1.5, sm: 2 } }}>
                  <Stack spacing={1} sx={{ minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ minWidth: 0 }}>
                        <Typography fontWeight={800} sx={{ minWidth: 0 }}>
                          {p.title}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                          sx={{ flexShrink: 0 }}
                        />
                      </Stack>
                      {p.summary && (
                        <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {p.summary}
                        </Typography>
                      )}
                      <Stack direction="row" justifyContent="flex-end">
                        <Typography variant="body2" color="primary" fontWeight={600}>
                          Đọc bài
                        </Typography>
                      </Stack>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
          {rows.length > pageSize && (
            <Stack direction="row" justifyContent="center">
              <Pagination
                page={page}
                count={Math.max(1, Math.ceil(rows.length / pageSize))}
                color="primary"
                shape="rounded"
                onChange={(_, p) => setPage(p)}
              />
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}

