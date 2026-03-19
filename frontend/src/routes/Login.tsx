import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <Card sx={{ width: "100%", maxWidth: 520 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={800}>
              Đăng nhập
            </Typography>
            <TextField
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              fullWidth
            />
            <TextField
              label="Mật khẩu"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
            />
            {err && <Alert severity="error">{err}</Alert>}
            <Stack direction="row" spacing={1} justifyContent="space-between">
              <Button component={Link} to="/register" variant="outlined" startIcon={<PersonAddAltOutlinedIcon />}>
                Tạo tài khoản
              </Button>
              <Button
                variant="contained"
                disabled={busy}
                startIcon={<LoginOutlinedIcon />}
                onClick={async () => {
                  setBusy(true);
                  setErr(null);
                  try {
                    await login(email, password);
                    nav(loc?.state?.from || "/", { replace: true });
                  } catch (e: any) {
                    setErr(e?.message || "login_failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Đăng nhập
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

