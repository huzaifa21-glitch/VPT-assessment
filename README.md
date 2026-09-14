# VPT Assignment — Mobile (Field Worker)

React Native + Expo app for field workers visiting households, built to keep working with no
internet connection. Plain JavaScript, Stack Navigation, minimal dependencies.

## Stack

- **Expo (managed workflow)** + React Native, plain `.js` files.
- **`@react-navigation/native-stack`** — Stack Navigation.
- **`expo-sqlite`** — local persistent storage.
- **`@react-native-community/netinfo`** — detects connectivity changes to trigger sync automatically.
- No UI kit, no state-management library, no axios — plain `fetch` and React's built-in
  `useState`/`useContext`.




## Authentication

Same shape as the web app: `POST /auth/login` issues an access token (15 min) + refresh token
(30 days); every request attaches the access token; a `401` triggers one silent
`POST /auth/refresh` and retry before giving up. Tokens live in `expo-secure-store` rather than
plain storage — meaningfully harder for another app or a compromised JS bundle to read than
`AsyncStorage`. This app only accepts `FIELD_WORKER` logins.

## Running it

You need the backend running and reachable from wherever you run this app (emulator, simulator,
or a physical phone) — see connectivity notes below.

```bash
npm install
cp .env.example .env
# Edit .env's EXPO_PUBLIC_API_BASE_URL per the table below

npx expo start
```



### Connectivity: what URL goes in `EXPO_PUBLIC_API_BASE_URL`

`localhost` means different things depending on where the app is actually running — it's *not*
your laptop from the emulator's/phone's point of view:

| Running on | Use |
|---|---|
| Android emulator | `http://10.0.2.2:4000/api/v1` (`10.0.2.2` is the emulator's alias for your host machine) |
| iOS simulator | `http://localhost:4000/api/v1` (the simulator shares your Mac's network stack) |
| Physical device (Expo Go) | `http://<your-computer's-LAN-IP>:4000/api/v1` — e.g. `http://192.168.1.23:4000/api/v1`. Your phone and computer must be on the same Wi-Fi network. Find your IP with `ipconfig` (Windows) or `ifconfig`/`ipconfig getifaddr en0` (Mac). |



### Seeded login

Use the field worker seeded by the backend: `test1@gmail.com` / `Pass1234`.
