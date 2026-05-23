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
}
