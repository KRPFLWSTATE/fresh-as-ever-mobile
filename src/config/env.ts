import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  API_BASE_URL,
  PAYHERE_RETURN_URL_HOST,
} from '@env';

export type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
  payHereReturnHost: string;
};

/** Fail fast during development when .env missing. */
export function readEnv(): AppEnv {
  return {
    supabaseUrl: (SUPABASE_URL || '').trim(),
    supabaseAnonKey: (SUPABASE_ANON_KEY || '').trim(),
    apiBaseUrl: (API_BASE_URL || '').replace(/\/$/, ''),
    payHereReturnHost: (PAYHERE_RETURN_URL_HOST || API_BASE_URL || '')
      .replace(/\/$/, '')
      .trim(),
  };
}
