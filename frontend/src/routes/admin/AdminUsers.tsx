import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
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
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

function roleLabel(r: "admin" | "student") {
  return r === "admin" ? "Admin" : "Học sinh";
}

export default function AdminUsers() {
  const { token, user } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(10);

  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "student">("student");
  const [resetPassword, setResetPassword] = useState("");

  const [openDelete, setOpenDelete] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);

  async function load() {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const data = await api.admin.listUsers(token, { q: q.trim() || undefined });
      setRows(data);
    } catch (e: any) {
      setErr(e?.message || "load_failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setPage(0);
  }, [q]);

  const filtered = useMemo(() => {
    // backend already filters by q, but keep safe if we later load all and filter client-side
    if (!rows) return [];
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) => (r.email || "").toLowerCase().includes(qq) || (r.full_name || "").toLowerCase().includes(qq));
  }, [rows, q]);

  const paged = useMemo(() => {
    const start = page * rpp;
    return filtered.slice(start, start + rpp);
  }, [filtered, page, rpp]);

  function trackSelf(row: any) {
    return !!user?.id && row?.id === user.id;
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} justifyContent="space-between">
        <Typography variant="h6" fontWeight={800}>
          Người dùng
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <Tooltip title="Trang Admin">
            <IconButton component={Link} to="/admin" size="small">
              <DashboardOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <TextField
            size="small"
            label="Tìm (email / tên)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ minWidth: { xs: "100%", sm: 320 } }}
          />
          <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={load} disabled={busy}>
            Reload
          </Button>
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            {err && <Alert severity="error">{err}</Alert>}
            {!rows ? (
              <Typography color="text.secondary">Đang tải...</Typography>
            ) : filtered.length === 0 ? (
              <Alert severity="info">Không có user.</Alert>
            ) : (
              <>
                <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflowX: "auto" }}>
                  <Table size="small" stickyHeader sx={{ minWidth: 760 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 70 }}>ID</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Tên</TableCell>
                        <TableCell sx={{ width: 120 }}>Role</TableCell>
                        <TableCell align="right" sx={{ width: 220 }}>
                          Thao tác
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paged.map((r) => (
                        <TableRow key={r.id} hover>
                          <TableCell>#{r.id}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {r.email}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                            <Typography variant="body2" color={r.full_name ? "text.primary" : "text.secondary"}>
                              {r.full_name || "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              variant="outlined"
                              color={r.role === "admin" ? "warning" : "default"}
                              label={roleLabel(r.role)}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setEditing(r);
                                  setEditName(r.full_name || "");
                                  setEditRole(r.role);
                                  setResetPassword("");
                                  setOpenEdit(true);
                                }}
                              >
                                Sửa
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                startIcon={<DeleteOutlineOutlinedIcon />}
                                disabled={trackSelf(r)}
                                onClick={() => {
                                  setDeleting(r);
                                  setOpenDelete(true);
                                }}
                              >
                                Xoá
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={filtered.length}
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
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="sm">
        <DialogTitle>Sửa user</DialogTitle>
        <DialogContent dividers>
          {!editing ? (
            <Typography color="text.secondary">—</Typography>
          ) : (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={`#${editing.id}`} />
                <Chip size="small" variant="outlined" label={editing.email} />
              </Stack>
              <TextField size="small" label="Họ tên" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <FormControl size="small">
                <InputLabel id="role-lbl">Role</InputLabel>
                <Select
                  labelId="role-lbl"
                  label="Role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                >
                  <MenuItem value="student">Học sinh</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
              <Box>
                <TextField
                  size="small"
                  label="Đổi mật khẩu"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  fullWidth
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Để trống nếu không muốn đổi.
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEdit(false)}>Huỷ</Button>
          <Button
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            disabled={!token || !editing}
            onClick={async () => {
              if (!token || !editing) return;
              setErr(null);
              try {
                const body: any = {
                  full_name: editName.trim() === "" ? null : editName.trim(),
                  role: editRole,
                };
                if (resetPassword.trim() !== "") body.password = resetPassword;
                const res = await api.admin.updateUser(token, editing.id, body);
                setRows((prev) => (prev ? prev.map((x) => (x.id === res.user.id ? res.user : x)) : prev));
                setOpenEdit(false);
              } catch (e: any) {
                setErr(e?.message || "update_failed");
              }
            }}
          >
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDelete} onClose={() => setOpenDelete(false)} fullWidth maxWidth="xs">
        <DialogTitle>Xoá user?</DialogTitle>
        <DialogContent dividers>
          {!deleting ? (
            <Typography color="text.secondary">—</Typography>
          ) : (
            <Stack spacing={1}>
              <Typography>
                Bạn chắc chắn muốn xoá <b>{deleting.email}</b>?
              </Typography>
              <Alert severity="warning">Hành động này không thể hoàn tác.</Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)}>Huỷ</Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteOutlineOutlinedIcon />}
            disabled={!token || !deleting}
            onClick={async () => {
              if (!token || !deleting) return;
              setErr(null);
              try {
                await api.admin.deleteUser(token, deleting.id);
                setRows((prev) => (prev ? prev.filter((x) => x.id !== deleting.id) : prev));
                setOpenDelete(false);
              } catch (e: any) {
                setErr(e?.message || "delete_failed");
              }
            }}
          >
            Xoá
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

