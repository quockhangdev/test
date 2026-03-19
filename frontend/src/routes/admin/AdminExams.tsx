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
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function AdminExams() {
  const { token } = useAuth();
  const [list, setList] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [accessPassword, setAccessPassword] = useState<string>("");
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reload() {
    if (!token) return;
    const exams = await api.admin.listExams(token);
    setList(exams);
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

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" fontWeight={800}>
          Đề thi
        </Typography>
        <Button variant="contained" onClick={() => setOpenCreate(true)} startIcon={<AddOutlinedIcon />}>
          Tạo đề mới
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={800}>
              Danh sách đề
            </Typography>
            {err && <Alert severity="error">{err}</Alert>}
            {!list ? (
              <Typography color="text.secondary">Đang tải...</Typography>
            ) : (
              <>
                {list.length === 0 ? (
                  <Alert severity="info">Chưa có đề.</Alert>
                ) : (
                  <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 70 }}>ID</TableCell>
                          <TableCell>Tiêu đề</TableCell>
                          <TableCell sx={{ width: 90 }}>Phút</TableCell>
                          <TableCell sx={{ width: 90 }}>Pass</TableCell>
                          <TableCell sx={{ width: 110 }}>Trạng thái</TableCell>
                          <TableCell>Mô tả</TableCell>
                          <TableCell align="right" sx={{ width: 120 }}>
                            Thao tác
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {list.map((e) => (
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
                            <TableCell sx={{ maxWidth: 520 }}>
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
                  access_password: accessPassword.trim() ? accessPassword : null
                });
                setOpenCreate(false);
                setTitle("");
                setDescription("");
                setDurationMinutes(45);
                setAccessPassword("");
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

