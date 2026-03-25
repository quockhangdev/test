import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, Card, CardContent, Chip, Stack, styled, Typography } from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SafeHtml } from "../components/SafeHtml";

export default function PostDetail() {
  const { slug } = useParams();
  const { token } = useAuth();
  const [post, setPost] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token || !slug) return;
        const p = await api.getPost(token, slug);
        if (alive) setPost(p);
      } catch (e: any) {
        if (alive) setErr(e?.message || "load_post_failed");
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, slug]);

  if (err) return <Alert severity="error">{err}</Alert>;
  if (!post) return <Typography color="text.secondary">Đang tải...</Typography>;

  const CardContentNoPadding = styled(CardContent)({
    padding: 0,
    "&:last-child": {
      paddingBottom: 0
    }
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" fontWeight={800}>
          {post.title}
        </Typography>
        <Button component={Link} to="/posts" variant="outlined" size="small" startIcon={<ArrowBackOutlinedIcon />}>
          Quay lại
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" variant="outlined" label={post.author?.full_name || post.author?.email || "Ẩn danh"} />
        <Chip size="small" variant="outlined" label={post.created_at ? new Date(post.created_at).toLocaleString() : "—"} />
      </Stack>
      {post.cover_image_url && (
        <Card variant="outlined">
          <CardContentNoPadding>
            <img src={post.cover_image_url} alt={post.title} style={{ width: "100%", display: "block", maxHeight: 380, objectFit: "cover" }} />
          </CardContentNoPadding>
        </Card>
      )}
      <Card variant="outlined">
        <CardContent>
          <SafeHtml html={post.content_markdown || ""} />
        </CardContent>
      </Card>
    </Stack>
  );
}

