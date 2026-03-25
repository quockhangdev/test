import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, CardContent, Chip, Pagination, Stack, Typography } from "@mui/material";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

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
            <Card key={p.id} variant="outlined">
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Typography fontWeight={800}>{p.title}</Typography>
                    <Chip size="small" variant="outlined" label={p.created_at ? new Date(p.created_at).toLocaleString() : "—"} />
                  </Stack>
                  {p.summary && (
                    <Typography variant="body2" color="text.secondary">
                      {p.summary}
                    </Typography>
                  )}
                  <Stack direction="row" justifyContent="flex-end">
                    <Button component={Link} to={`/posts/${p.slug}`} size="small" variant="outlined">
                      Đọc bài
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
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

