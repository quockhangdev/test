import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Register() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={loc?.state?.from || "/"} replace />;
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <Card sx={{ width: "100%", maxWidth: 520 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={800}>
              Đăng ký
            </Typography>
            <TextField label="Họ tên" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            <TextField label="Mật khẩu" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            {err && <Alert severity="error">{err}</Alert>}
            {ok && <Alert severity="success">{ok}</Alert>}
            <Stack direction="row" spacing={1} justifyContent="space-between">
              <Button component={Link} to="/login" variant="outlined" startIcon={<LoginOutlinedIcon />}>
                Đã có tài khoản
              </Button>
              <Button
                variant="contained"
                disabled={busy}
                startIcon={<PersonAddAltOutlinedIcon />}
                onClick={async () => {
                  setBusy(true);
                  setErr(null);
                  setOk(null);
                  try {
                    await api.register({ email, password, full_name: fullName || undefined });
                    setOk("Đăng ký thành công. Chuyển sang đăng nhập...");
                    setTimeout(() => nav("/login"), 600);
                  } catch (e: any) {
                    setErr(e?.message || "register_failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Tạo tài khoản
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

