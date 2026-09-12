# Community Health Field Survey — Web (Super Admin)

React + Vite + JavaScript admin console for the Super Admin role. Talks to the backend's
`/api/v1` REST API. Kept deliberately simple — this app is a thin layer over the backend;
almost no business logic lives here.

## Stack

- **React 19 + Vite** — plain JavaScript (`.jsx`, no TypeScript).
- **Tailwind CSS v4** (via `@tailwindcss/vite` — no `tailwind.config.js` or `postcss.config.js`
  needed for this setup; Tailwind is wired in through `vite.config.js` and a single
  `@import "tailwindcss";` in `src/index.css`).
- **react-router-dom** — client-side routing.
- No other libraries — API calls use the browser's built-in `fetch`, not axios, to keep the
  dependency list small.

## Project layout

```
src/
  api/client.js            Single fetch wrapper for every backend call (auth header injection,
                            silent refresh-on-401, JSON handling, error messages)
  auth/
    AuthContext.jsx         Holds the logged-in user + login()/logout(), backed by localStorage
    ProtectedRoute.jsx       Redirects to /login if there's no session
  components/
    Layout.jsx               Sidebar + page frame (used by every page except Login)
    StatCard.jsx, Badge.jsx, EmptyState.jsx    Small reusable pieces
  pages/
    LoginPage.jsx
    DashboardPage.jsx        Stats + recent activity
    FieldWorkersPage.jsx     List, create, activate/deactivate, assign area
    HouseholdsPage.jsx       List, search, filter by area
    HouseholdDetailPage.jsx  Household info, members, per-member assessments
    NotFoundPage.jsx
  App.jsx                   Route definitions
  main.jsx                  Entry point (wraps App in AuthProvider + BrowserRouter)
```

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

Log in with the seeded Super Admin credentials from the backend (`admin@healthsurvey.local` /
`ChangeMe123!` unless you changed them).

```bash
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

## What's covered vs. what's intentionally left out

Covered (matches the assignment's web-app requirements): login, dashboard stats, field worker
list/create/activate/deactivate/area-assignment, household list/search/filter, household
members, and per-member health assessments.

Left out on purpose, since the brief says UI polish isn't the focus:
- No toast notifications — errors show as inline text.
- No client-side form validation beyond HTML5 `required`/`minLength` (the backend validates
  everything properly with Zod; this UI trusts it and just surfaces the error message back).
- No pagination controls on the households/field-workers tables yet, even though the backend
  API supports `page`/`pageSize` — fine at the data volumes this assessment seeds/tests with.
- No household creation from the web app — the assignment only asks the admin to *view* households,
  members, and assessments (creation is the field worker's job via mobile).
