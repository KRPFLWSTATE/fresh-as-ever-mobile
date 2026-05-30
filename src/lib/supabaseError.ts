import type { PostgrestError } from '@supabase/supabase-js';
import { ERROR } from '@/lib/messages/errors';

/**
 * Maps Supabase/Postgres errors to stable user-facing copy.
 * Full messages are logged only in __DEV__.
 */
export function mapSupabaseError(
  error: PostgrestError | Error | null | undefined,
  fallback: string = ERROR.common.fallback,
): string {
  if (!error) return fallback;
  const code = 'code' in error ? String(error.code ?? '') : '';
  const message = String(error.message ?? '').toLowerCase();

  if (code === '42501' || message.includes('permission') || message.includes('rls')) {
    return ERROR.common.permission;
  }
  if (code === 'PGRST116' || message.includes('0 rows')) {
    return ERROR.common.notFound;
  }
  if (code === '23505') {
    return ERROR.common.duplicate;
  }
  if (code === 'P0001' || message.includes('sold out') || message.includes('quantity')) {
    return ERROR.checkout.soldOut;
  }
  if (message.includes('network') || message.includes('fetch')) {
    return ERROR.common.network;
  }
  if (
    message.includes('jwt') ||
    message.includes('session') ||
    message.includes('not authenticated') ||
    code === 'PGRST301'
  ) {
    return ERROR.auth.sessionExpired;
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return ERROR.common.network;
  }
  if (__DEV__ && error.message) {
    return `${fallback} (${error.message})`;
  }
  return fallback;
}

export function logSupabaseError(
  error: unknown,
  context: string,
): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[supabase] ${context}`, error);
  }
}
