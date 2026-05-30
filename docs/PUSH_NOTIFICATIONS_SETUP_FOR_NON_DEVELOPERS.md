# Push notifications — setup guide (non-developer)

This is what **you** need to do in websites and on your Mac. The **code and database** are already done in the repo.

---

## What “README checklist after rebuild” means

That is **not** more coding. It is a **short test list** (tap through the app) to confirm nothing broke after you install a new build. Think of it like a pilot walking around the plane before takeoff.

You only run that list **after** you rebuild the iPhone app (see Part A below).

---

## Already done for you (no action)

| Item | Status |
|------|--------|
| Database tables & trigger (when shelf is published → queue) | Applied on Supabase |
| Edge Function `notify-shelf-published` | Deployed on Supabase (if deploy succeeded) |
| Mobile app code for push permission + saving token | In the project |
| Website cron route code | In the project (needs Vercel deploy — Part C) |

---

## Part A — Rebuild the iPhone app (required for push on phone)

**Why:** Push needs Apple’s “allow notifications” wiring inside the app. That only updates when you build a **new** app in Xcode, not when you only refresh JavaScript.

**Steps (high level):**

1. On your Mac, open **Terminal** (Spotlight → type Terminal → Enter).
2. Go to the mobile folder (your developer can give the exact `cd` path).
3. Run `npm install` once if they ask you to.
4. Open the **iOS** project in **Xcode** (often `ios/FreshAsEverMobile.xcworkspace`).
5. Plug in your iPhone **or** pick a simulator.
6. Click the **Play** (▶) button to build and run.
7. On the phone: sign in as a **customer** → **Profile** → **Notifications** → turn **Push** on → tap **Allow** when iOS asks.

**Note:** Push alerts on a **real iPhone** are reliable. The simulator often does **not** show real push banners.

---

## Part B — Supabase (optional: Expo secret)

Only if you want production-grade push volume from Expo:

1. Go to [https://expo.dev](https://expo.dev) and sign in.
2. Open your project (or create one with `eas init` — ask your developer).
3. Copy an **access token** if Expo shows one for push.
4. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) → project **Fresh As Ever**.
5. **Edge Functions** → **Secrets** → **New secret**
6. Name: `EXPO_ACCESS_TOKEN` → paste token → Save.

**If you skip this:** Basic Expo push may still work for small testing.

---

## Part C — Deploy the website on Vercel (required for automatic processing)

**Why:** Every 2 minutes Vercel calls Supabase to send queued shelf notifications. Until the **latest website** is deployed, that timer does not exist in production.

**Steps:**

1. Go to [https://vercel.com](https://vercel.com) → your **Fresh As Ever** project.
2. Make sure the latest code is on GitHub (your developer merges/pushes).
3. Open **Deployments** → wait for the newest deployment to show **Ready** (or click **Redeploy** on the latest).
4. **Settings** → **Environment Variables** → confirm `CRON_SECRET` exists (same one used for pickup SMS reminders). If missing, add a long random password and save, then redeploy.

You do **not** need to create the cron by hand — it is already in `vercel.json` in the repo.

---

## Part D — Expo project ID (one-time, with developer help)

The app needs an Expo “project id” so Apple/Google can issue a push token.

- Easiest: developer runs `eas init` in the mobile folder and sets `EXPO_PUBLIC_EAS_PROJECT_ID` in `.env`.
- Until then, a placeholder id is in `app.config.js` — may work for testing but a real Expo project is better for App Store.

---

## How to know it works

1. Customer account **favourites** a shop (e.g. Bakehouse).
2. Customer enables **Push** in Profile (after Part A rebuild).
3. Merchant **publishes** today’s clearance shelf.
4. Within about **2 minutes** (after Part C Vercel deploy):
   - Favouriting customers get an **in-app** notification (always, if cron runs).
   - They get a **phone banner** only if they allowed push and use a real device with a saved token.

---

## What you do **not** need to do

- Run SQL in Supabase (already applied).
- Manually create database triggers.
- Write code for the Edge Function (deployed via dashboard/MCP).

If something fails, send your developer: “queue has rows but `processed_at` is null” or “no rows in `push_device_tokens`” — that narrows it down quickly.
