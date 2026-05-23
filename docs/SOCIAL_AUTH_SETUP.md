# Google & Apple sign-in setup

The apps use **Supabase Auth** for social login. You configure providers in the Supabase dashboard; the repos only call `signInWithOAuth` / native Apple.

## 1. Supabase (required)

Project: `odkbpeelvcdmlimdflbr`

1. [Authentication → Providers](https://supabase.com/dashboard/project/odkbpeelvcdmlimdflbr/auth/providers)
2. Enable **Google** and **Apple**; paste each provider’s client ID / secret from Google Cloud and Apple Developer.
3. [Authentication → URL configuration](https://supabase.com/dashboard/project/odkbpeelvcdmlimdflbr/auth/url-configuration) → **Redirect URLs** — add every URL you use:

| Environment | Redirect URL |
|-------------|----------------|
| Mobile | `freshasever://auth/callback` |
| Web production | `https://YOUR_DOMAIN/auth/callback` |
| Web local | `http://localhost:3000/auth/callback` |

4. **Site URL** should match your primary web origin (e.g. `https://freshasever.com` or local dev URL).

## 2. Google Cloud Console

1. Create an OAuth 2.0 **Web client** (for Supabase).
2. Authorized redirect URI (from Supabase Google provider page):  
   `https://odkbpeelvcdmlimdflbr.supabase.co/auth/v1/callback`
3. Copy Client ID + Secret into Supabase Google provider settings.

## 3. Apple Developer

1. App ID with **Sign in with Apple** enabled (`com.freshasever.mobile`).
2. Services ID for web OAuth (redirect to Supabase callback URL above).
3. Key for Sign in with Apple; configure in Supabase Apple provider.
4. For **native iOS** (`signInWithIdToken`): use the same Apple app configuration Supabase documents for native Apple login.

### iOS native capability (mobile)

After pulling this branch, run:

```bash
cd ios && pod install && cd ..
```

In Xcode → target **FreshAsEverMobile** → **Signing & Capabilities** → **+ Capability** → **Sign in with Apple**.

## 4. Verify

**Web:** Login → Customer → **Continue with Google** / **Apple** → returns to `/auth/callback` → `/discover`.

**Mobile:** Login → Customer → same buttons → in-app browser → deep link `freshasever://auth/callback` → signed in.

## Code map

| Piece | Location |
|-------|----------|
| Mobile OAuth helper | `src/lib/socialAuth.ts` |
| Mobile UI | `src/ui/auth/SocialAuthButtons.tsx`, `LoginScreen.tsx` |
| Mobile context | `AuthContext.tsx` (`signInWithGoogle`, `signInWithApple`) |
| Web callback | `fresh-as-ever/src/app/auth/callback/route.js` |
| Web UI | `src/components/auth/SocialAuthButtons.js`, login page |
