import React, { useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography
} from "@mui/material";
import logoUrl from "../../logo.png";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
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
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const menuOpen = !!menuEl;

  const menuItems = useMemo<Array<{ key: string; label: string; to?: string; icon?: React.ReactNode; onClick?: () => void }>>(() => {
    if (loading) return [];
    if (user) {
      const items: Array<{ key: string; label: string; to?: string; icon?: React.ReactNode; onClick?: () => void }> = [];
      if (user.role === "admin") items.push({ key: "admin", label: "Admin", to: "/admin", icon: <AdminPanelSettingsOutlinedIcon fontSize="small" /> });
      items.push({ key: "logout", label: "Đăng xuất", icon: <LogoutOutlinedIcon fontSize="small" />, onClick: logout });
      return items;
    }
    return [
      { key: "login", label: "Đăng nhập", to: "/login", icon: <LoginOutlinedIcon fontSize="small" /> },
      { key: "register", label: "Đăng ký", to: "/register", icon: <PersonAddAltOutlinedIcon fontSize="small" /> }
    ];
  }, [loading, user, logout]);

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
              sx={{
                textDecoration: "none",
                color: "text.primary",
                fontWeight: 800,
                flexGrow: 1,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              Ôn thi Tin học THPT QG
            </Typography>
            {/* <Chip label="Flask + SQLite API" size="small" variant="outlined" /> */}
            {loading ? (
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                Đang tải...
              </Typography>
            ) : (
              <>
                {user && (
                  <Chip
                    label={`${user.full_name || user.email} · ${user.role}`}
                    size="small"
                    variant="outlined"
                    sx={{ display: { xs: "none", md: "inline-flex" } }}
                  />
                )}

                {/* Desktop actions */}
                <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1 }}>
                  {user ? (
                    <>
                      {user.role === "admin" && (
                        <Button component={Link} to="/admin" variant="outlined" size="small" startIcon={<AdminPanelSettingsOutlinedIcon />}>
                          Admin
                        </Button>
                      )}
                      <Button color="inherit" variant="text" size="small" onClick={logout} startIcon={<LogoutOutlinedIcon />}>
                        Đăng xuất
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button component={Link} to="/login" state={{ from: loc.pathname }} variant="outlined" size="small" startIcon={<LoginOutlinedIcon />}>
                        Đăng nhập
                      </Button>
                      <Button component={Link} to="/register" variant="contained" size="small" startIcon={<PersonAddAltOutlinedIcon />}>
                        Đăng ký
                      </Button>
                    </>
                  )}
                </Box>

                {/* Mobile menu */}
                <Box sx={{ display: { xs: "block", sm: "none" } }}>
                  <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)} aria-label="menu">
                    <MenuOutlinedIcon />
                  </IconButton>
                  <Menu
                    anchorEl={menuEl}
                    open={menuOpen}
                    onClose={() => setMenuEl(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                  >
                    {user && (
                      <MenuItem disabled>
                        <Typography variant="body2" sx={{ maxWidth: 240 }} noWrap>
                          {user.full_name || user.email}
                        </Typography>
                      </MenuItem>
                    )}
                    {menuItems.map((it) => (
                      <MenuItem
                        key={it.key}
                        component={it.to ? Link : "li"}
                        to={it.to as any}
                        onClick={() => {
                          setMenuEl(null);
                          if (it.onClick) it.onClick();
                        }}
                        sx={{ gap: 1 }}
                      >
                        {it.icon}
                        {it.label}
                      </MenuItem>
                    ))}
                  </Menu>
                </Box>
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
          px: isExam ? { xs: 1, md: 3, lg: 4 } : { xs: 1.5, sm: 2 }
        }}
      >
        {children}
      </Container>
      <Divider />
      <Box component="footer" sx={{ py: 2, bgcolor: "background.paper" }}>
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary">
          Ôn thi Tin học Trung học Phổ thông Quốc gia © 2026
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

