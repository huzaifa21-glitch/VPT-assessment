import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, getStoredUser, getTokens, setStoredUser, setTokens } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [initializing, setInitializing] = useState(true);

  // On first load, if we have a token, re-fetch the current user to confirm
  // the session is still valid (and pick up any role/area changes made
  // elsewhere) rather than trusting whatever was cached in localStorage.
  useEffect(() => {
    const { accessToken } = getTokens();
    if (!accessToken) {
      setInitializing(false);
      return;
    }
    api
      .me()
      .then((freshUser) => {
        setUser(freshUser);
        setStoredUser(freshUser);
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setInitializing(false));
  }, []);

  async function login(email, password) {
    const data = await api.login(email, password);
    if (data.user.role !== 'SUPER_ADMIN') {
      throw new Error('This dashboard is for Super Admin accounts only.');
    }
    setTokens(data);
    setStoredUser(data.user);
    setUser(data.user);
  }

  async function logout() {
    const { refreshToken } = getTokens();
    try {
      if (refreshToken) await api.logout(refreshToken);
    } catch {
      // Ignore — we clear the local session regardless of whether the
      // server call succeeded, so the user is never stuck logged in.
    }
    clearSession();
    setUser(null);
  }

  const value = useMemo(() => ({ user, initializing, login, logout }), [user, initializing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
