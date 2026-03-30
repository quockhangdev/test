import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useMdEditorImageUpload } from "../../lib/mdEditorImageUpload";

export default function AdminPosts() {
  const { token } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);

  const mdImg = useMdEditorImageUpload({ token, onError: setErr });

  async function reload() {
    if (!token) return;
    const list = await api.admin.listPosts(token);
    setRows(list);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token) return;
        const list = await api.admin.listPosts(token);
        if (alive) setRows(list);
      } catch (e: any) {
        if (alive) setErr(e?.message || "load_posts_failed");
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setSlug("");
    setSummary("");
    setCoverImageUrl("");
    setContent("");
    setPublished(false);
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" fontWeight={800}>Bài viết</Typography>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          Bài viết mới
        </Button>
      </Stack>

      {err && <Alert severity="error">{err}</Alert>}
      {!rows ? (
        <Typography color="text.secondary">Đang tải...</Typography>
      ) : rows.length === 0 ? (
        <Alert severity="info">Chưa có bài viết.</Alert>
      ) : (
        <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 70 }}>ID</TableCell>
                <TableCell>Tiêu đề</TableCell>
                <TableCell sx={{ width: 120 }}>Slug</TableCell>
                <TableCell sx={{ width: 120 }}>Trạng thái</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.title}</TableCell>
                  <TableCell>{r.slug}</TableCell>
                  <TableCell>{r.is_published ? "Published" : "Draft"}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Sửa">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingId(r.id);
                            setTitle(r.title || "");
                            setSlug(r.slug || "");
                            setSummary(r.summary || "");
                            setCoverImageUrl(r.cover_image_url || "");
                            setContent(r.content_markdown || "");
                            setPublished(!!r.is_published);
                            setOpen(true);
                          }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Xoá">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={async () => {
                            if (!confirm("Xoá bài viết này?")) return;
                            try {
                              await api.admin.deletePost(token!, r.id);
                              await reload();
                            } catch (e: any) {
                              setErr(e?.message || "delete_post_failed");
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

      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullScreen>
        <DialogTitle sx={{ py: 0.75, px: { xs: 1, sm: 2 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight={800}>
              {editingId ? `Sửa bài #${editingId}` : "Thêm bài viết"}
            </Typography>
            <IconButton size="small" onClick={() => !busy && setOpen(false)}>
              <CloseOutlinedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ flex: 1, overflowY: "auto" }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField fullWidth size="small" label="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} />
              <TextField fullWidth size="small" label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </Stack>
            <TextField size="small" label="Mô tả ngắn" value={summary} onChange={(e) => setSummary(e.target.value)} fullWidth />
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
              <TextField
                fullWidth
                size="small"
                label="URL ảnh bìa"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
              />
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFileOutlinedIcon />}
                sx={{ minWidth: 180 }}
              >
                Upload ảnh
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const res = await api.admin.uploadImage(token!, file);
                      setCoverImageUrl(res.url);
                    } catch (errUpload: any) {
                      setErr(errUpload?.message || "upload_failed");
                    } finally {
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </Button>
            </Stack>
            {coverImageUrl && (
              <Box>
                <Typography variant="caption" color="text.secondary">Preview ảnh bìa</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <img src={coverImageUrl} alt="cover" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 8 }} />
                </Box>
              </Box>
            )}
            <FormControlLabel
              control={<Checkbox checked={published} onChange={(e) => setPublished(e.target.checked)} />}
              label="Publish ngay"
            />
            <Box data-color-mode="light">
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                Nội dung (Markdown)
              </Typography>
              <MDEditor
                value={content}
                onChange={(v) => setContent(v || "")}
                preview="edit"
                height={420}
                textareaProps={mdImg.textareaProps}
                extraCommands={mdImg.extraCommands}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Chèn ảnh: nút upload trên thanh công cụ, dán (paste) hoặc kéo thả ảnh vào vùng soạn thảo.
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>Huỷ</Button>
          <Button
            variant="contained"
            disabled={busy || !title.trim() || !slug.trim()}
            onClick={async () => {
              try {
                setBusy(true);
                setErr(null);
                const payload = {
                  title: title.trim(),
                  slug: slug.trim(),
                  summary: summary.trim() || null,
                  content_markdown: content,
                  cover_image_url: coverImageUrl.trim() || null,
                  is_published: published
                };
                if (editingId) {
                  await api.admin.updatePost(token!, editingId, payload);
                } else {
                  await api.admin.createPost(token!, payload);
                }
                setOpen(false);
                resetForm();
                await reload();
              } catch (e: any) {
                setErr(e?.message || "save_post_failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {editingId ? "Lưu" : "Tạo bài"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

