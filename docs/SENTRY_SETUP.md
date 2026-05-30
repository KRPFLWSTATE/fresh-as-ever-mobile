# Sentry (React Native)

Project: **react-native** · Org: **flwstate-media-kx** · Region: **DE** (`ingest.de.sentry.io`).

## App runtime (required)

1. Copy `.env.example` → `.env` and set `SENTRY_DSN` (client DSN from [Sentry project settings](https://sentry.io/settings/flwstate-media-kx/projects/react-native/keys/)).
2. Rebuild the native app after changing env (`npm run ios` / `npm run android`).

The SDK initializes in `src/observability/initSentry.ts` (imported first from `index.js`). React errors are also reported from `RootErrorBoundary`.

## Source maps & debug symbols (release builds)

Uploads need a **Sentry auth token** with `project:releases` (and org access). Do **not** commit the token.

1. Create a token: [Sentry → Settings → Auth Tokens](https://sentry.io/settings/account/api/auth-tokens/).
2. Copy `.env.sentry-build-plugin.example` → `.env.sentry-build-plugin` in the repo root and set `SENTRY_AUTH_TOKEN=...`.
3. Add `.env.sentry-build-plugin` to your local secret store (1Password, etc.); it is gitignored.

`ios/sentry.properties` and `android/sentry.properties` point at org/project; the build plugin reads the token from `.env.sentry-build-plugin` or `SENTRY_AUTH_TOKEN` in the environment.

### Optional: re-run the official wizard

From the mobile repo root (interactive login may be required):

```bash
cd /Users/kawinperera/Fresh-as-Ever/fresh-as-ever-mobile
npx @sentry/wizard@latest -i reactNative --saas --org flwstate-media-kx --project react-native
```

Use this if you want Sentry to refresh Xcode/Gradle phases; the repo already includes manual hooks aligned with the wizard.

### Verify

- Trigger a test event in dev: `Sentry.captureMessage('FAE mobile smoke test')` from a one-off screen or the Metro console after init.
- After a release build, confirm a release appears under **Releases** in Sentry and that symbolicated stack traces load.

## CI / EAS

Set `SENTRY_AUTH_TOKEN` (and optionally `SENTRY_DSN` if not baked into `.env` for that lane) as encrypted secrets on your build provider. Disable uploads on PR builds with `SENTRY_DISABLE_AUTO_UPLOAD=true` if needed.
