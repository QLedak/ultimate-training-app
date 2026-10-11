# Getting this on TestFlight

TestFlight lets friends and athletes install the app on their own iPhones. You do the Apple steps; the project is already set up for it.
Commands below run from the `mobile` folder unless noted. Apple and Expo change their screens now and then, so if a button is named slightly differently, follow the closest match.

## 0. Before you start (once)
1. **Enroll in the Apple Developer Program** (developer.apple.com/programs, $99/year). Approval can take a day or two, so do this first. Use the Apple ID you want to own the app.
2. **Make a free Expo account** at expo.dev.
3. Make sure the website's latest code is pushed and deployed (the app talks to it), and that `EXPO_PUBLIC_API_URL` in `mobile/.env` is your real `https://` website, not a local address.

## 1. Prepare the project (once)
```powershell
# Re-run setup: adds version, the encryption flag and notification color. Keeps your existing app name and id.
node scripts/finish-setup.js

# Install the EAS build tool and sign in
npm install -g eas-cli
eas login

# Link the project to your Expo account (answer yes to create it)
eas init

# Copy the public values from .env into eas.json so cloud builds can see them
node scripts/eas-env.js
```
Optional: set `EXPO_PUBLIC_SUPPORT_EMAIL` in `.env` (then run `node scripts/eas-env.js` again) to show a "Help & feedback" row in the app.

Your **bundle id** (in `app.json`, e.g. `com.yourname.ultimatetraining`) is permanent once you upload a build. Check it now.

## 2. Build and upload
```powershell
eas build --platform ios --profile production
```
EAS asks you to sign in to your Apple account and creates the certificates for you. The first build takes 15 to 30 minutes. Then:
```powershell
eas submit --platform ios --latest
```
This uploads it to App Store Connect. Build numbers go up automatically each time.

## 3. App Store Connect (appstoreconnect.apple.com)
1. **Apps > + > New App.** Platform iOS, name, primary language, pick your bundle id, and any SKU (e.g. `ultimate-training`).
2. Wait for the build to finish "processing" (usually under an hour). It appears under **TestFlight**.
3. **Internal testing:** add yourself and up to 100 people from your App Store Connect team. No review needed.
4. **External testing** (anyone with an email or link, up to 10,000): create a group, add the build, fill in the **Test Information**, and submit. The first external build gets a short Apple review, usually a day.

### What to enter
- **Privacy Policy URL:** `https://YOUR-SITE/privacy`
- **Support URL:** your website or a contact page. Apple requires a working one.
- **Test Information / App Review notes:** Apple reviews external builds, so give them a working login: a **demo athlete account** that already has a published plan. To make one: create an account in the app, finish intake, then in your coach dashboard build and approve a plan for it. Put its email and password in the review notes, plus a line like "Ultimate frisbee strength training. Plans are built by a coach; payments are not enabled yet."
- **App Privacy ("nutrition labels"):** answer from what the app actually collects:
  - Contact info: name and email (linked to the user, used for the app's function).
  - Health & fitness: workouts, injury and pain information, bodyweight and lift numbers (linked to the user, app function).
  - Diagnostics: crash data (not linked to advertising).
  - Tracking: **No.** The app does not track users across other companies' apps or sites.
- **Account deletion:** the app has Delete account under My info. Apple asks about this and it's there.
- **Export compliance:** already answered by the app config (no extra question).

## 4. When something goes wrong
- Build fails on a missing variable: run `node scripts/eas-env.js` again and check it printed all three `EXPO_PUBLIC_` names.
- App opens to a white screen or "Missing EXPO_PUBLIC_...": the same cause.
- Testers see crashes: they are reported to your Sentry project (the same one as the website), tagged `mobile`.
- Changing the app's code later: bump nothing by hand. Run `eas build` and `eas submit` again.

## Not done yet (separate work)
- Push notifications when your coach publishes a plan.
- Payments. Apple requires in-app purchase for paid plans sold inside the app. Everything is free right now, which keeps review simple.
