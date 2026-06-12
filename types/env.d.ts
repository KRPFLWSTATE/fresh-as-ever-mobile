declare module '@env' {
  export const SUPABASE_URL: string;
  export const SUPABASE_ANON_KEY: string;
  export const API_BASE_URL: string;
  export const PAYHERE_RETURN_URL_HOST: string | undefined;
  /** Set to `true` or `1` on staging builds only — enables QA test-email role overrides. */
  export const ENABLE_QA_ROLE_OVERRIDES: string | undefined;
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
}
