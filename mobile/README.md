# Ultimate Training - phone app (Expo / React Native)

A second front end for the SAME backend as the website. Nothing about the website changes.
Screens in v1: Login, Today (phase outline + week strip), Schedule, Workout preview and set-by-set logging (effort slider,
rest timer, replace exercise, history), My programs + test results, Progress (per-exercise estimated 1RM chart and history). Buying programs and the coach screens stay on the web.

## One-time setup (Windows + iPhone)

You need: Node.js 20+ (you already have it for the website) and the free **Expo Go** app from the iPhone App Store.
No Apple developer account is needed for this.

Open PowerShell in the **repo root** (the folder that contains `package.json` and `mobile/`):

```powershell
# 1. Generate a fresh Expo project next to our files (so versions always match Expo Go)
npx create-expo-app@latest _scaffold --template blank-typescript

# 2. Copy the generated config into mobile/ (our source files in mobile/ are kept)
Copy-Item _scaffold\package.json, _scaffold\app.json, _scaffold\tsconfig.json mobile\ -Force
Copy-Item _scaffold\assets mobile\assets -Recurse -Force
Remove-Item _scaffold -Recurse -Force

# 3. Install the libraries (expo install picks versions that match your Expo version)
cd mobile
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context @react-native-community/slider expo-keep-awake expo-status-bar expo-linear-gradient

# 4. Name the app (change the id to something of yours; you can change it later)
node scripts/finish-setup.js "Ultimate Training" com.yourname.ultimatetraining

# 5. Tell the app where your backend is
Copy-Item .env.example .env
notepad .env
```

In `.env` set:
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase > Project Settings > API. **Anon key only. Never the service-role key.**
- `EXPO_PUBLIC_API_URL` - your deployed website, e.g. `https://your-app.vercel.app` (no trailing slash).
  The deployed site must have the latest code (the bearer-token login support) pushed first.

## Run it

```powershell
cd mobile
npx expo start -c
```

Scan the QR code with the iPhone **Camera** app, open it in Expo Go, and sign in with your website account.
Phone and PC must be on the same Wi-Fi. If the QR code won't connect (some routers/VPNs block it), use `npx expo start --tunnel`
(it will offer to install a small helper the first time).

Code changes on your PC reload on the phone automatically. Shake the phone for the developer menu.

## How it stays in sync with the website

`src/shared/` holds copies of the website's training rules (effort scale, weight suggestions, prescription parsing).
They are copied from `../lib` automatically before every `npx expo start` (or run `npm run sync`).
**Never edit `src/shared` by hand.** `npm test` in the repo root fails if the copies drift.

## Updating after testing

- Fix on the phone side: edit files in `mobile/src`, save, the phone reloads.
- Fix on the backend: change the website code, push (Vercel redeploys), and the phone picks it up on next refresh - no phone update needed.
- Later, to share with testers or ship: EAS Build / TestFlight / App Store (this is where the $99/yr Apple account comes in).

## Troubleshooting

- "Missing EXPO_PUBLIC_..." red screen: `.env` is missing or not filled in. Fix it and restart with `npx expo start -c`.
- "Can't reach the server": wrong `EXPO_PUBLIC_API_URL`, or the site isn't deployed with the latest code.
- Signed in but "Finish setting up": that account has no athlete profile yet - complete intake on the website.
- Login works but every screen says Not signed in: the deployed site doesn't have the bearer-token update yet.

## Updating an existing setup

If you already ran setup: unzip over the repo, then from `mobile/` run `npx expo install expo-linear-gradient` and `node scripts/finish-setup.js "Ultimate Training" com.yourname.ultimatetraining` (safe to re-run; it switches the app to dark mode), then `npx expo start -c`.
