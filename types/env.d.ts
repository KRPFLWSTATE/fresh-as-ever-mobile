declare module '@env' {
  export const SUPABASE_URL: string;
  export const SUPABASE_ANON_KEY: string;
  export const API_BASE_URL: string;
  export const PAYHERE_RETURN_URL_HOST: string | undefined;
  /** Set to `true` or `1` on staging builds only — enables QA test-email role overrides. */
  export const ENABLE_QA_ROLE_OVERRIDES: string | undefined;
  /** Staging only: autofill QA login fields when exactly `true`. Requires QA password env vars. */
  export const EXPO_PUBLIC_QA_AUTOFILL_LOGIN: string | undefined;
  export const EXPO_PUBLIC_QA_MERCHANT_EMAIL: string | undefined;
  /** Staging only — never commit real passwords; set in local `.env` or CI secrets. */
  export const EXPO_PUBLIC_QA_CUSTOMER_PASSWORD: string | undefined;
  export const EXPO_PUBLIC_QA_MERCHANT_PASSWORD: string | undefined;
  /**
   * When exactly the string `true` (after trim; case-sensitive), enables isolated
   * merchant demo fixtures. Add to project-root `.env` — never ship `true` in production.
   */
  export const EXPO_PUBLIC_FAE_DEMO_MODE: string | undefined;
  /** When exactly `true`, enables multi-bag group cart and checkout. */
  export const EXPO_PUBLIC_GROUP_RESERVATIONS_ENABLED: string | undefined;
  /** When exactly `true`, enables clearance shelf listings (supermarket outlets). */
  export const EXPO_PUBLIC_CLEARANCE_SHELVES_ENABLED: string | undefined;
  /** Sentry client DSN — optional; omit to disable crash reporting locally. */
  export const SENTRY_DSN: string | undefined;
  /** Google Maps SDK key — branded Discover map tiles (see `.env.example`). */
  export const GOOGLE_MAPS_API_KEY: string | undefined;
  /** Pass 26 feature flags — default off in `.env.example`. */
  export const EXPO_PUBLIC_LISTING_WHATSAPP_SHARE: string | undefined;
  export const EXPO_PUBLIC_MONTHLY_SAVINGS_PUSH: string | undefined;
  export const EXPO_PUBLIC_NEIGHBOURHOOD_BROWSE: string | undefined;
  export const EXPO_PUBLIC_ON_MY_WAY: string | undefined;
  export const EXPO_PUBLIC_PICKUP_WINDOW_PRESETS: string | undefined;
  export const EXPO_PUBLIC_SEASONAL_BADGES: string | undefined;
}
