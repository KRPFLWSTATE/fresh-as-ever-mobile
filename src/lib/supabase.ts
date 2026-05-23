import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv } from '@/config/env';
import { supabaseSecureStorage } from '@/lib/supabaseSecureStorage';

let client: SupabaseClient | null = null;

/**
 * Supabase auth session persistence uses Keychain (via EncryptedStorage) with
 * a small wrapper so `removeItem` never rejects (iOS Simulator Keychain edge cases).
 */
export function getSupabase(env: AppEnv): SupabaseClient {
  if (client) {
    return client;
  }
  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: supabaseSecureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
