import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import PeopleOutlineOutlinedIcon from "@mui/icons-material/PeopleOutlineOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function AdminExams() {
  const { token } = useAuth();
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(10);

  const [openCreate, setOpenCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [accessPassword, setAccessPassword] = useState<string>("");
  const [tagsText, setTagsText] = useState<string>("");
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);

  function parseTags(s: string): string[] {
    const parts = s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return Array.from(new Set(parts)).slice(0, 20);
  }

  async function reload() {
    if (!token) return;
    const exams = await api.admin.listExams(token);
    setList(exams);
    setPage(0);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token) return;
        const exams = await api.admin.listExams(token);
        if (alive) setList(exams);
      } catch (e: any) {
        if (alive) setErr(e?.message || "error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const pagedList = list ? list.slice(page * rpp, page * rpp + rpp) : [];

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" fontWeight={800}>
          Đề thi
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Trang Admin">
            <IconButton component={Link} to="/admin" size="small">
              <DashboardOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Người dùng">
            <IconButton component={Link} to="/admin/users" size="small">
              <PeopleOutlineOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button variant="contained" onClick={() => setOpenCreate(true)} startIcon={<AddOutlinedIcon />}>
            Tạo đề mới
          </Button>
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            {err && <Alert severity="error">{err}</Alert>}
            {!list ? (
              <Typography color="text.secondary">Đang tải...</Typography>
            ) : (
              <>
                {list.length === 0 ? (
                  <Alert severity="info">Chưa có đề.</Alert>
                ) : (
                  <>
                    <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflowX: "auto" }}>
                      <Table size="small" stickyHeader sx={{ minWidth: 860 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: 70 }}>ID</TableCell>
                            <TableCell>Tiêu đề</TableCell>
                            <TableCell sx={{ width: 90 }}>Phút</TableCell>
                            <TableCell sx={{ width: 90 }}>Pass</TableCell>
                            <TableCell sx={{ width: 110 }}>Trạng thái</TableCell>
                            <TableCell sx={{ width: 220, display: { xs: "none", md: "table-cell" } }}>Tags</TableCell>
                            <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Mô tả</TableCell>
                            <TableCell align="right" sx={{ width: 120 }}>
                              Thao tác
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {pagedList.map((e) => (
                            <TableRow key={e.id} hover>
                              <TableCell>{e.id}</TableCell>
                              <TableCell sx={{ maxWidth: 420 }}>
                                <Typography fontWeight={700} noWrap title={e.title}>
                                  {e.title}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {e.duration_minutes ?? "—"}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color={e.requires_password ? "warning.main" : "text.secondary"}>
                                  {e.requires_password ? "Có" : "—"}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color={e.is_published ? "success.main" : "text.secondary"}>
                                  {e.is_published ? "Published" : "Draft"}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ maxWidth: 220, display: { xs: "none", md: "table-cell" } }}>
                                <Typography variant="body2" color="text.secondary" noWrap title={(e.tags || []).join(", ")}>
                                  {(e.tags || []).length ? (e.tags || []).join(", ") : "—"}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ maxWidth: 520, display: { xs: "none", md: "table-cell" } }}>
                                <Typography variant="body2" color="text.secondary" noWrap title={e.description || ""}>
                                  {e.description || "—"}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                  <Tooltip title="Sửa đề + câu hỏi">
                                    <IconButton component={Link} to={`/admin/exams/${e.id}`} size="small">
                                      <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Xoá">
                                    <IconButton
                                      color="error"
                                      size="small"
                                      onClick={async () => {
                                        if (!confirm("Xoá đề này?")) return;
                                        try {
                                          await api.admin.deleteExam(token!, e.id);
                                          await reload();
                                        } catch (ex: any) {
                                          setErr(ex?.message || "delete_failed");
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
                    <TablePagination
                      component="div"
                      count={list.length}
                      page={page}
                      onPageChange={(_, p) => setPage(p)}
                      rowsPerPage={rpp}
                      onRowsPerPageChange={(e) => {
                        setRpp(parseInt(e.target.value, 10));
                        setPage(0);
                      }}
                      rowsPerPageOptions={[5, 10, 20, 50]}
                      labelRowsPerPage="Dòng/trang"
                    />
                  </>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={openCreate}
        onClose={() => {
          if (!busy) setOpenCreate(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Tạo đề mới</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Tiêu đề"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              fullWidth
            />
            <TextField
              label="Mô tả"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={4}
              fullWidth
            />
            <TextField
              label="Thời gian làm bài (phút)"
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              inputProps={{ min: 1, max: 600, step: 1 }}
              fullWidth
            />
            <TextField
              label="Password đề (để trống nếu không cần)"
              type="password"
              value={accessPassword}
              onChange={(e) => setAccessPassword(e.target.value)}
              fullWidth
            />
            <TextField
              label="Tags (phân tách bằng dấu phẩy)"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="SQL, C++, HTML"
              fullWidth
            />
            <FormControlLabel
              control={<Checkbox checked={published} onChange={(e) => setPublished(e.target.checked)} />}
              label="Publish ngay"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<CloseOutlinedIcon />}
            onClick={() => {
              if (!busy) {
                setOpenCreate(false);
                setTitle("");
                setDescription("");
                setDurationMinutes(45);
                setAccessPassword("");
                setTagsText("");
                setPublished(false);
              }
            }}
          >
            Huỷ
          </Button>
          <Button
            variant="contained"
            disabled={busy || !title.trim()}
            startIcon={<CheckOutlinedIcon />}
            onClick={async () => {
              try {
                setBusy(true);
                setErr(null);
                await api.admin.createExam(token!, {
                  title: title.trim(),
                  description: description.trim() || null,
                  is_published: published,
                  duration_minutes: Number.isFinite(durationMinutes) ? durationMinutes : null,
                  access_password: accessPassword.trim() ? accessPassword : null,
                  tags: parseTags(tagsText)
                });
                setOpenCreate(false);
                setTitle("");
                setDescription("");
                setDurationMinutes(45);
                setAccessPassword("");
                setTagsText("");
                setPublished(false);
                await reload();
              } catch (e: any) {
                setErr(e?.message || "create_failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Tạo
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

