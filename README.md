# Community Health Field Survey — Mobile (Field Worker)

React Native + Expo app for field workers visiting households, built to keep working with no
internet connection. Plain JavaScript (no TypeScript), Stack Navigation, minimal dependencies.

## Stack

- **Expo (managed workflow)** + React Native, plain `.js` files.
- **`@react-navigation/native-stack`** — Stack Navigation, as requested.
- **`expo-sqlite`** — local persistent storage (see "Why SQLite" below).
- **`expo-secure-store`** — JWT tokens, backed by the platform Keychain (iOS) / Keystore (Android).
- **`@react-native-community/netinfo`** — detects connectivity changes to trigger sync automatically.
- No UI kit, no state-management library, no axios — plain `fetch` and React's built-in
  `useState`/`useContext`, kept deliberately minimal.

## Project layout

```
App.js                      Entry point: opens the DB, then renders AuthProvider + RootNavigator
src/
  db/
    database.js               Opens the SQLite DB, creates tables (see schema below)
    syncableRecord.js          Shared state-transition rules for create/update/delete/conflict —
                                written once, reused by all three repos below
    householdsRepo.js          CRUD + sync-state handling for households
    membersRepo.js             Same, for household members
    assessmentsRepo.js         Same, for health assessments (+ local "will be urgent" preview)
    syncMeta.js                 Tiny key/value store — currently just tracks lastPulledAt
  api/client.js               fetch wrapper: bearer token, silent refresh-on-401, offline detection
  auth/AuthContext.js          Login/logout, session restore on app start
  sync/
    syncEngine.js               push() / pull() / runSync() — the actual sync logic
    SyncStatusContext.js         Wraps syncEngine in React state: online/offline, counts, "syncing"
  components/
    Loader.js                   Reusable rotating-ring spinner (fullscreen or inline)
    SyncStatusBar.js             Global banner: online/offline, pending count, "Sync now"
    SyncBadge.js                 Small per-record pill: Synced / Pending / Conflict / Failed
    TextField.js, PrimaryButton.js, ChipSelect.js, EmptyState.js, theme.js   Small shared UI pieces
  screens/
    LoginScreen.js
    HouseholdListScreen.js       Home screen: assigned area, search, household list
    HouseholdFormScreen.js       Add/edit household
    HouseholdDetailScreen.js     Household info + members list + conflict resolution
    MemberFormScreen.js         Add/edit member
    MemberDetailScreen.js        Member info + assessments list + conflict resolution
    AssessmentFormScreen.js      Add/edit assessment, with a live "will be urgent" preview
    SyncStatusScreen.js          Every not-yet-synced record in one place, for review/retry
  navigation/RootNavigator.js   The stack itself — swaps to the Login stack when logged out
```

## Why SQLite (`expo-sqlite`)

Considered `expo-sqlite` vs. WatermelonDB vs. Realm. Went with `expo-sqlite` because:
- It's an official Expo package — no extra native config, works in the standard managed workflow.
- The data model here is small and simple (3 tables, no complex relations beyond foreign keys) —
  WatermelonDB's reactive/observable layer is built for much larger local datasets and adds real
  setup complexity (schema migrations, model classes, sync adapters) that this app doesn't need.
- Plain SQL is easy to reason about for exactly the kind of manual sync-state bookkeeping this app
  does (see below) — an ORM-like layer would mostly get in the way of that.

## How offline storage + sync actually work

Every syncable table (`households`, `household_members`, `health_assessments`) carries the same
extra columns alongside its normal fields:

| Column | Meaning |
|---|---|
| `version` | Mirrors the backend's version counter — used for conflict detection |
| `syncStatus` | `synced` \| `pending` \| `conflict` \| `error` |
| `pendingOperation` | `CREATE` \| `UPDATE` \| `DELETE` \| `NULL` — what's queued, if anything |
| `baseVersion` | The server version this queued change was made against |
| `pendingChangeId` | A stable id reused across retries of the *same* queued change |
| `conflictServerSnapshot` | The server's copy, only set while `syncStatus = 'conflict'` |
| `lastSyncError` | Message from the last failed push attempt |

**Only one outstanding change is tracked per record at a time.** Editing a record that's already
`pending` just updates its fields in place and reuses the same `pendingChangeId`/`baseVersion` —
it does not queue a second change. This is what `src/db/syncableRecord.js` encodes once, so
`householdsRepo`/`membersRepo`/`assessmentsRepo` don't each reimplement the same rules slightly
differently (and can't drift out of sync with each other).

**Push** (`syncEngine.js`): gathers every row with `syncStatus IN ('pending', 'error')` across all
three tables, in that order — households before members before assessments — because a
brand-new household and a brand-new member of it might both be queued in the same sync, and the
backend applies its `changes` array strictly in order, so the household must be created before the
member that references it. Sends them to `POST /sync/push` in batches of 200 (the backend's
limit), then reconciles each result back onto the local row it came from:
- `APPLIED` → adopt the server's version/fields, mark `synced`.
- `CONFLICT` → mark `conflict`, keep the local edit intact, store the server's copy for the user to
  review (nothing is silently lost).
- `ERROR` → mark `error`, keep the queued change so the next sync retries it automatically.

**Pull**: fetches everything changed since the last successful pull (`GET /sync/pull?since=...`)
and applies it locally — except a row gets skipped if it currently has an unsynced local edit
(`syncStatus != 'synced'`), so a pull can never silently overwrite work the user hasn't pushed yet;
that reconciliation happens through the conflict path on the next push instead.

**Idempotency**: `pendingChangeId` is generated once per queued change and reused across retries,
so a repeated push of the same change (app killed mid-sync, retried later) is a no-op replay on
the backend rather than a duplicate.

**Offline deletions**: deleting a record that was never synced just removes it locally (nothing
the server needs to know). Deleting a synced record sets `deletedAt` + queues a `DELETE`, which
follows the exact same version-check/conflict path as an update.

**Triggers**: sync runs on app launch, whenever `NetInfo` reports the device just came back online,
and via the "Sync now" button (`SyncStatusBar`, present on every main screen, and the dedicated
Sync Status screen). There's no background/periodic polling — kept out deliberately to avoid
battery drain and added complexity; see Trade-offs.

## Sync status indicator

Both halves the assignment asks for are implemented:
- **Per-record**: a colored `SyncBadge` (Synced / Pending / Conflict / Failed) on every household,
  member, and assessment card.
- **Global**: `SyncStatusBar` at the top of the main screens (online/offline, pending count,
  "Sync now"), plus a dedicated **Sync Status** screen listing every outstanding record with a
  reason and a tap-through to resolve it.

## Authentication

Same shape as the web app: `POST /auth/login` issues an access token (15 min) + refresh token
(30 days); every request attaches the access token; a `401` triggers one silent
`POST /auth/refresh` and retry before giving up. Tokens live in `expo-secure-store` rather than
plain storage — meaningfully harder for another app or a compromised JS bundle to read than
`AsyncStorage`. This app only accepts `FIELD_WORKER` logins.

## Running it

You need the backend running and reachable from wherever you run this app (emulator, simulator,
or a physical phone) — see connectivity notes below, this trips people up more than anything else.

```bash
npm install
cp .env.example .env
# Edit .env's EXPO_PUBLIC_API_BASE_URL per the table below

npx expo start
```

Then either press `a` (Android emulator), `i` (iOS simulator, macOS only), or scan the QR code
with the Expo Go app on a physical phone.

### Connectivity: what URL goes in `EXPO_PUBLIC_API_BASE_URL`

`localhost` means different things depending on where the app is actually running — it's *not*
your laptop from the emulator's/phone's point of view:

| Running on | Use |
|---|---|
| Android emulator | `http://10.0.2.2:4000/api/v1` (`10.0.2.2` is the emulator's alias for your host machine) |
| iOS simulator | `http://localhost:4000/api/v1` (the simulator shares your Mac's network stack) |
| Physical device (Expo Go) | `http://<your-computer's-LAN-IP>:4000/api/v1` — e.g. `http://192.168.1.23:4000/api/v1`. Your phone and computer must be on the same Wi-Fi network. Find your IP with `ipconfig` (Windows) or `ifconfig`/`ipconfig getifaddr en0` (Mac). |

If you change `.env`, restart `expo start` (env vars are inlined at bundle time, not read live).

### Seeded login

Use the field worker seeded by the backend: `fieldworker1@healthsurvey.local` / `FieldWorker123!`
(from the backend's `npm run seed`).

### Trying the offline flow

1. With the backend reachable, log in once (so the app has valid tokens cached).
2. Turn on airplane mode / disconnect Wi-Fi.
3. Add a household, a member, an assessment, edit something. Notice the sync badges show
   "Pending" and the top bar shows a count — all writes still work, nothing blocks on the network.
4. Close and reopen the app — the data is still there (this is the actual offline-storage
   requirement: SQLite persists across app restarts, unlike in-memory state).
5. Reconnect. Sync should kick off automatically within a moment (NetInfo-triggered); status
   badges flip to "Synced". You can also just tap "Sync now".

### Trying the conflict flow

1. Log in on the mobile app and open a household that also exists in the web admin app.
2. Go offline on mobile, edit the household's address.
3. While mobile is still offline, edit the *same* household from the web admin app (which is
   online, so its edit reaches the server immediately, bumping the version).
4. Reconnect the mobile app and sync. The push comes back `CONFLICT` (its `baseVersion` is now
   stale) — the household's card and detail screen show a conflict banner with "Use server
   version" / "Keep my changes", instead of either edit silently winning.

## Trade-offs / what I'd do with more time

- No background/periodic sync — only on launch, reconnect, and manual trigger. A production app
  might add a periodic timer or a native background-fetch task.
- No photo/attachment support (not asked for in the brief).
- No field-level merge on conflicts — the user picks one whole version or the other, per record.
- No pagination for the household list — fine at the data volumes this assessment seeds/tests with,
  would need it for a very large assigned area.
- No automated test suite for this app yet (unlike the backend) — the conflict/idempotency logic
  it depends on is already covered by the backend's tests; this app's own logic (`syncableRecord.js`,
  `syncEngine.js`) is written to be pure/testable but isn't tested here yet.
