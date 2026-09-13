import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearTokens, getTokens, setTokens } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      const { accessToken } = await getTokens();
      if (!accessToken) {
        setInitializing(false);
        return;
      }
      try {
        const freshUser = await api.me();
        setUser(freshUser);
      } catch {
        await clearTokens();
        setUser(null);
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  async function login(email, password) {
    const data = await api.login(email, password);
    if (data.user.role !== 'FIELD_WORKER') {
      throw new Error('This app is for Field Worker accounts only.');
    }
    await setTokens(data);

    const fullUser = await api.me();
    setUser(fullUser);
  }

  async function logout() {
    const { refreshToken } = await getTokens();
    try {
      if (refreshToken) await api.logout(refreshToken);
    } catch {
     
    }
    await clearTokens();
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
