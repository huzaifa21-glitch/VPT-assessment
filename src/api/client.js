import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:4000/api/v1';

const ACCESS_TOKEN_KEY = 'hs_access_token';
const REFRESH_TOKEN_KEY = 'hs_refresh_token';

// expo-secure-store wraps the platform keychain (iOS Keychain / Android
// Keystore) — a meaningfully safer place for tokens than plain storage,
// and the standard choice for Expo apps.
export async function getTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  return { accessToken, refreshToken };
}

export async function setTokens({ accessToken, refreshToken }) {
  if (accessToken) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken() {
  const { refreshToken } = await getTokens();
  if (!refreshToken) throw new Error('No refresh token available');

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh failed');

  const data = await res.json();
  await setTokens(data);
  return data.accessToken;
}

// Same shape as the web app's api/client.js: attach the bearer token, retry
// once after a silent refresh on 401, surface a clean error message otherwise.
// The one RN-specific difference is that fetch failing outright (no response
// at all) means "offline" — callers use isOffline(err) to tell that apart
// from a real server error.
async function request(path, { method = 'GET', body, skipAuth = false, _retried = false } = {}) {
  const { accessToken } = await getTokens();
  const headers = { 'Content-Type': 'application/json' };
  if (!skipAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const offlineError = new Error('You appear to be offline.');
    offlineError.isOffline = true;
    throw offlineError;
  }

  if (res.status === 401 && !skipAuth && !_retried) {
    try {
      await refreshAccessToken();
      return request(path, { method, body, skipAuth, _retried: true });
    } catch {
      await clearTokens();
      const sessionError = new Error('Your session expired — please log in again.');
      sessionError.sessionExpired = true;
      throw sessionError;
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(data?.error?.message || 'Something went wrong. Please try again.');
  }
  return data;
}

export function isOffline(err) {
  return !!err?.isOffline;
}

function toQuery(params = {}) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  );
  const qs = new URLSearchParams(filtered).toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password }, skipAuth: true }),
  logout: (refreshToken) =>
    request('/auth/logout', { method: 'POST', body: { refreshToken }, skipAuth: true }),
  me: () => request('/users/me'),

  listAreas: () => request('/areas'),

  syncPush: (changes) => request('/sync/push', { method: 'POST', body: { changes } }),
  syncPull: (since) => request(`/sync/pull${toQuery({ since })}`),
};
