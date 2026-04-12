import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

type User = { id: string; email: string; role: "admin" | "student"; full_name: string | null };

type AuthState = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);

const LS_TOKEN = "auth_token";
const LS_USER = "auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(LS_TOKEN));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(LS_USER);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (token) {
          const me = await api.me(token);
          const u: User = { id: me.id, email: me.email, role: me.role as any, full_name: me.full_name };
          if (alive) setUser(u);
          localStorage.setItem(LS_USER, JSON.stringify(u));
        }
      } catch {
        if (alive) {
          setToken(null);
          setUser(null);
          localStorage.removeItem(LS_TOKEN);
          localStorage.removeItem(LS_USER);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      loading,
      login: async (email: string, password: string) => {
        const res = await api.login({ email, password });
        setToken(res.access_token);
        setUser(res.user);
        localStorage.setItem(LS_TOKEN, res.access_token);
        localStorage.setItem(LS_USER, JSON.stringify(res.user));
      },
      logout: () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem(LS_TOKEN);
        localStorage.removeItem(LS_USER);
      }
    }),
    [token, user, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

