import React from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Toolbar,
  Typography
} from "@mui/material";
import logoUrl from "../../logo.png";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import { AuthProvider, useAuth } from "../lib/auth";
import Home from "./Home";
import Login from "./Login";
import Register from "./Register";
import TakeExam from "./TakeExam";
import Admin from "./Admin";

function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const loc = useLocation();
  const isExam = loc.pathname.startsWith("/exams/");
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="sticky"
        color="default"
        elevation={0}
        sx={{
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider"
        }}
      >
        <Toolbar>
          <Container maxWidth="lg" sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              component={Link}
              to="/"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none"
              }}
            >
              <Box
                component="img"
                src={logoUrl}
                alt="Logo"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: 1,
                  borderColor: "divider",
                  mr: 1
                }}
              />
            </Box>
            <Typography
              component={Link}
              to="/"
              variant="h6"
              sx={{ textDecoration: "none", color: "text.primary", fontWeight: 800, flexGrow: 1 }}
            >
              Ôn thi Tin học THPT QG
            </Typography>
            {/* <Chip label="Flask + SQLite API" size="small" variant="outlined" /> */}
            {loading ? (
              <Typography variant="body2" color="text.secondary">
                Đang tải...
              </Typography>
            ) : user ? (
              <>
                <Chip
                  label={`${user.full_name || user.email} · ${user.role}`}
                  size="small"
                  variant="outlined"
                />
                {user.role === "admin" && (
                  <Button
                    component={Link}
                    to="/admin"
                    variant="outlined"
                    size="small"
                    startIcon={<AdminPanelSettingsOutlinedIcon />}
                  >
                    Admin
                  </Button>
                )}
                <Button
                  color="inherit"
                  variant="text"
                  size="small"
                  onClick={logout}
                  startIcon={<LogoutOutlinedIcon />}
                >
                  Đăng xuất
                </Button>
              </>
            ) : (
              <>
                <Button
                  component={Link}
                  to="/login"
                  state={{ from: loc.pathname }}
                  variant="outlined"
                  size="small"
                  startIcon={<LoginOutlinedIcon />}
                >
                  Đăng nhập
                </Button>
                <Button
                  component={Link}
                  to="/register"
                  variant="contained"
                  size="small"
                  startIcon={<PersonAddAltOutlinedIcon />}
                >
                  Đăng ký
                </Button>
              </>
            )}
          </Container>
        </Toolbar>
      </AppBar>
      <Container
        maxWidth={isExam ? false : "lg"}
        sx={{
          py: 3,
          flex: 1,
          px: isExam ? { xs: 1, md: 3, lg: 4 } : undefined
        }}
      >
        {children}
      </Container>
      <Divider />
      <Box component="footer" sx={{ py: 2, bgcolor: "background.paper" }}>
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary">
            © 2026
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Typography>Đang tải...</Typography>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <Typography>Đang tải...</Typography>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/exams/:examId"
            element={
              <RequireAuth>
                <TakeExam />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/*"
            element={
              <RequireAdmin>
                <Admin />
              </RequireAdmin>
            }
          />
        </Routes>
      </Shell>
    </AuthProvider>
  );
}

