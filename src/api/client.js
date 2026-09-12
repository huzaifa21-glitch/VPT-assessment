const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

const ACCESS_TOKEN_KEY = 'hs_access_token';
const REFRESH_TOKEN_KEY = 'hs_refresh_token';
const USER_KEY = 'hs_user';

export function getTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

async function refreshAccessToken() {
  const { refreshToken } = getTokens();
  if (!refreshToken) throw new Error('No refresh token available');

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh failed');

  const data = await res.json();
  setTokens(data);
  return data.accessToken;
}

// Core request helper — attaches the bearer token, and if a request comes
// back 401 (expired access token), tries ONE silent refresh-and-retry before
// giving up and forcing a fresh login. Every api.* call below goes through this,
// so no page needs to think about token refresh itself.
async function request(path, { method = 'GET', body, skipAuth = false, _retried = false } = {}) {
  const { accessToken } = getTokens();
  const headers = { 'Content-Type': 'application/json' };
  if (!skipAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipAuth && !_retried) {
    try {
      await refreshAccessToken();
      return request(path, { method, body, skipAuth, _retried: true });
    } catch {
      clearSession();
      window.location.assign('/login');
      throw new Error('Your session expired — please log in again.');
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.error?.message || 'Something went wrong. Please try again.';
    throw new Error(message);
  }
  return data;
}

function toQuery(params = {}) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
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

  getDashboardStats: () => request('/dashboard/stats'),
  getDashboardActivity: () => request('/dashboard/activity'),

  listAreas: () => request('/areas'),

  listFieldWorkers: (params) => request(`/users/field-workers${toQuery(params)}`),
  createFieldWorker: (payload) => request('/users/field-workers', { method: 'POST', body: payload }),
  setFieldWorkerStatus: (id, isActive) =>
    request(`/users/field-workers/${id}/status`, { method: 'PATCH', body: { isActive } }),
  assignFieldWorkerArea: (id, areaId) =>
    request(`/users/field-workers/${id}/area`, { method: 'PATCH', body: { areaId } }),

  listHouseholds: (params) => request(`/households${toQuery(params)}`),
  getHousehold: (id) => request(`/households/${id}`),
  listMembersByHousehold: (householdId) => request(`/members/by-household/${householdId}`),
  listAssessmentsByMember: (memberId) => request(`/assessments/by-member/${memberId}`),
};
