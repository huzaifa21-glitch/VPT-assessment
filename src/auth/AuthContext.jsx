import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, getStoredUser, getTokens, setStoredUser, setTokens } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [initializing, setInitializing] = useState(true);

 
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
