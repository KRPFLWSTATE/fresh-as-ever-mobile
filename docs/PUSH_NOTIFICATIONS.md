# Push notifications (Expo + Supabase)

Shelf publish alerts (plan **7.8**) notify customers who **favourited the outlet** when a clearance shelf is first published.

## What was missing (blockers)

| Gap | Fix |
|-----|-----|
| No `expo-notifications` / token registration | Mobile `pushNotifications.ts` + `usePushNotifications` |
| No `profiles.notification_prefs` column in DB | Migration `20260530180000_shelf_publish_push_notifications.sql` |
| No device token storage | Table `push_device_tokens` |
| No server fan-out on publish | DB trigger → `shelf_publish_notification_queue` → Edge Function + Vercel cron |

## Flow

1. Merchant publishes shelf (`clearance_shelves.status` → `published`).
2. Trigger inserts a row into `shelf_publish_notification_queue`.
3. Vercel cron `GET /api/cron/shelf-publish-notifications` every **2 minutes** invokes Edge Function `notify-shelf-published`.
4. Function loads favourite customers, respects `notification_prefs.push`, inserts in-app `notifications`, sends Expo push to `push_device_tokens`.

## Supabase secrets (Edge Function)

| Secret | Purpose |
|--------|---------|
| `EXPO_ACCESS_TOKEN` | Optional; recommended for production Expo push volume |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEYS` | Service role (same as SMS function) |

Deploy:

```bash
cd fresh-as-ever
supabase functions deploy notify-shelf-published --project-ref odkbpeelvcdmlimdflbr --no-verify-jwt
```

## Vercel

Cron added in `vercel.json` (`*/2 * * * *`). Uses `CRON_SECRET` like pickup reminders.

Manual drain:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://<vercel-host>/api/cron/shelf-publish-notifications"
```

## Mobile setup

1. `npm install` (includes `expo-notifications`, `expo-device`, `expo-constants`).
2. Set **`EXPO_PUBLIC_EAS_PROJECT_ID`** to your Expo project UUID (`eas init`), or use the placeholder in `app.config.js` until you create a project.
3. **Rebuild native app** (`npx expo prebuild` / Xcode) so the notifications plugin and iOS `remote-notification` entitlement apply.
4. Customer: Profile → Notifications → enable **Push** (requests iOS permission and saves token).

## Test checklist

1. Customer favourites Bakehouse, enables push, rebuild app → row in `push_device_tokens`.
2. Merchant publishes today’s shelf → queue row → within ~2 min cron → in-app notification + push (simulator push works on physical device; simulator may not receive remote push).
3. Toggle push off → no Expo send (in-app row may still be created for favourites).

## Web

Push registration is **mobile-only** for v1. Web customers still get in-app `notifications` rows when the cron runs.
