# Community Health Field Survey — Web (Super Admin)

React + Vite + JavaScript admin console for the Super Admin role. Talks to the backend's
`/api/v1` REST API.

## Stack

- **React 19 + Vite** — plain JavaScript.
- **Tailwind CSS v4** (via `@tailwindcss/vite` 
  needed for this setup; Tailwind is wired in through `vite.config.js` and a single
  `@import "tailwindcss";` in `src/index.css`).
- **react-router-dom** — client-side routing.
- No other libraries — API calls use the browser's built-in `fetch`, not axios, to keep the
  dependency list small.

## How auth works here

- On login, the backend's `accessToken` + `refreshToken` + `user` are stored in `localStorage`.
- Every API call goes through `api/client.js`'s `request()` helper, which attaches
  `Authorization: Bearer <accessToken>` automatically.
- If a request comes back `401` (expired access token), it's retried **once** after silently
  calling `/auth/refresh` — so a session just keeps working across the 15-minute access-token
  window without the user noticing, until the refresh token itself expires (30 days) or is
  revoked (logout).
- This app only accepts `SUPER_ADMIN` logins — if a field worker's credentials are used, the
  login is rejected client-side with a clear message (the backend would reject their token on
  every admin endpoint anyway; this just gives a nicer message before that happens).
- Storing tokens in `localStorage` is the simple choice for this assessment; it's readable by
  any script on the page (XSS risk) — an httpOnly cookie would be more robust in production, at
  the cost of more backend/CORS setup. Noted here rather than silently picked.

## Setup

Needs the backend running first (see the backend repo's README) — this app has nothing to talk
to otherwise.

```bash
npm install
cp .env.example .env
# Edit .env if your backend isn't on the default http://localhost:4000

npm run dev
# → http://localhost:5173
```

Log in with the seeded Super Admin credentials from the backend (`admin@local.com` /
`Admin1234`).


